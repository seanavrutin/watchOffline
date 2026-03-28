const cron = require('node-cron');
const { db } = require('../firebase');
const { getSeasonDetails, getImdbIdFromTmdbId } = require('../services/tmdb');
const qbt = require('../services/qbittorrent');
const { findAndDownloadEpisode, recheckMissingSubs } = require('../services/downloader');
const { sendReport, buildReportHtml } = require('../services/mailer');
const admin = require('firebase-admin');

const SHOWS_COLLECTION = 'shows';
const MAX_SUB_RETRIES = 14;

async function runEpisodeCheck() {
  console.log('[episodeChecker] Starting daily episode check...');
  const results = [];

  try {
    const snapshot = await db.collection(SHOWS_COLLECTION).get();
    const shows = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(s => s.trackedSeasons?.length > 0);

    if (shows.length === 0) {
      console.log('[episodeChecker] No shows with tracked seasons');
      await sendDailyReport(results);
      return;
    }

    let allTorrents = [];
    try {
      const cookie = await qbt.login();
      allTorrents = await qbt.getTorrents(cookie);
    } catch (err) {
      console.error('[episodeChecker] qBittorrent unavailable:', err.message);
    }

    for (const show of shows) {
      console.log(`[episodeChecker] Checking: ${show.title} (tracked seasons: ${show.trackedSeasons.join(', ')})`);

      const titleNorm = show.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      const matchingTorrents = allTorrents.filter(t => {
        const nameNorm = t.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return nameNorm.includes(titleNorm);
      });

      const episodeStatusMap = {};
      for (const t of matchingTorrents) {
        const parsed = qbt.parseEpisodeFromName(t.name);
        if (!parsed) continue;
        const key = `S${String(parsed.season).padStart(2, '0')}E${String(parsed.episode).padStart(2, '0')}`;
        const isComplete = t.progress >= 1;
        const existing = episodeStatusMap[key];
        if (!existing || (isComplete && existing.status !== 'downloaded')) {
          episodeStatusMap[key] = {
            status: isComplete ? 'downloaded' : 'downloading',
            hash: t.hash,
            name: t.name,
          };
        }
      }

      let imdbId = null;
      try {
        imdbId = await getImdbIdFromTmdbId(show.tmdbId, 'tv');
      } catch (err) {
        console.error(`[episodeChecker] Failed to get IMDb ID for ${show.title}:`, err.message);
      }

      const today = new Date().toISOString().split('T')[0];

      // --- PHASE 1: Find & download new episodes ---
      for (const seasonNum of show.trackedSeasons) {
        let seasonData;
        try {
          seasonData = await getSeasonDetails(show.tmdbId, seasonNum);
        } catch (err) {
          console.error(`[episodeChecker] Failed to fetch S${String(seasonNum).padStart(2, '0')} for ${show.title}:`, err.message);
          continue;
        }

        if (!seasonData?.episodes) continue;

        for (const ep of seasonData.episodes) {
          const epNum = ep.episode_number;
          const key = `S${String(seasonNum).padStart(2, '0')}E${String(epNum).padStart(2, '0')}`;
          const airDate = ep.air_date || null;
          const aired = airDate ? airDate <= today : false;

          const existing = episodeStatusMap[key];
          if (existing) continue;

          if (!aired) continue;

          console.log(`[episodeChecker] Missing: ${show.title} ${key} — attempting download`);

          try {
            const result = await findAndDownloadEpisode({
              title: show.title,
              tmdbId: show.tmdbId,
              imdbId,
              season: seasonNum,
              episode: epNum,
              requireHebrewSubs: false,
            });

            if (result.success) {
              const outcome = result.hebrewSubSaved ? 'downloaded' : 'downloaded_no_subs';
              results.push({
                outcome,
                show: show.title,
                key,
                epName: ep.name || null,
                torrentName: result.torrentName,
                seeders: result.seeders,
                subScore: result.subScore,
                subtitlesSaved: result.subtitlesSaved,
              });

              if (!result.hebrewSubSaved) {
                await trackMissingSubs(show.id, key, result.infoHash, result.torrentName);
              }
            } else {
              results.push({
                outcome: 'failed',
                show: show.title,
                key,
                epName: ep.name || null,
                reason: 'No suitable torrents found',
              });
            }
          } catch (err) {
            results.push({
              outcome: 'failed',
              show: show.title,
              key,
              epName: ep.name || null,
              reason: err.message,
            });
          }

          await sleep(2000);
        }
      }

      // --- PHASE 2: Recheck episodes with missing Hebrew subs ---
      const missingHebSubs = show.missingHebSubs || {};
      for (const [key, entry] of Object.entries(missingHebSubs)) {
        if (entry.retries >= MAX_SUB_RETRIES) {
          console.log(`[episodeChecker] ${show.title} ${key} — max retries (${MAX_SUB_RETRIES}) reached, giving up`);
          await clearMissingSubs(show.id, key);
          results.push({
            outcome: 'subs_gave_up',
            show: show.title,
            key,
            reason: `Gave up after ${MAX_SUB_RETRIES} retries`,
          });
          continue;
        }

        const torrentStillExists = allTorrents.some(t => t.hash === entry.torrentHash);
        if (!torrentStillExists) {
          console.log(`[episodeChecker] ${show.title} ${key} — torrent no longer in qBittorrent, clearing`);
          await clearMissingSubs(show.id, key);
          continue;
        }

        try {
          const parsed = parseKey(key);
          const result = await recheckMissingSubs({
            title: show.title,
            imdbId,
            season: parsed.season,
            episode: parsed.episode,
            torrentHash: entry.torrentHash,
            torrentName: entry.torrentName,
          });

          if (result.outcome === 'subs_recovered') {
            await clearMissingSubs(show.id, key);
            results.push({
              outcome: 'subs_recovered',
              show: show.title,
              key,
              subtitlesSaved: result.subtitlesSaved,
            });
          } else if (result.outcome === 'subs_swapped') {
            await clearMissingSubs(show.id, key);
            results.push({
              outcome: 'subs_swapped',
              show: show.title,
              key,
              newTorrentName: result.newTorrentName,
              seeders: result.seeders,
              subScore: result.subScore,
              subtitlesSaved: result.subtitlesSaved,
            });
          } else {
            await incrementSubRetry(show.id, key);
            results.push({
              outcome: 'subs_still_missing',
              show: show.title,
              key,
              retries: (entry.retries || 0) + 1,
            });
          }
        } catch (err) {
          console.error(`[episodeChecker] Recheck failed for ${show.title} ${key}:`, err.message);
          await incrementSubRetry(show.id, key);
        }

        await sleep(2000);
      }
    }
  } catch (err) {
    console.error('[episodeChecker] Fatal error:', err.message);
  }

  await sendDailyReport(results);
  console.log('[episodeChecker] Finished. Results:', results.length);
}

function parseKey(key) {
  const match = key.match(/S(\d{2})E(\d{2})/);
  return { season: parseInt(match[1], 10), episode: parseInt(match[2], 10) };
}

async function trackMissingSubs(showId, key, torrentHash, torrentName) {
  await db.collection(SHOWS_COLLECTION).doc(showId).update({
    [`missingHebSubs.${key}`]: {
      torrentHash,
      torrentName,
      since: new Date().toISOString().split('T')[0],
      retries: 0,
    },
  });
}

async function clearMissingSubs(showId, key) {
  await db.collection(SHOWS_COLLECTION).doc(showId).update({
    [`missingHebSubs.${key}`]: admin.firestore.FieldValue.delete(),
  });
}

async function incrementSubRetry(showId, key) {
  await db.collection(SHOWS_COLLECTION).doc(showId).update({
    [`missingHebSubs.${key}.retries`]: admin.firestore.FieldValue.increment(1),
  });
}

async function sendDailyReport(results) {
  const date = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  const downloaded = results.filter(r => r.outcome === 'downloaded' || r.outcome === 'downloaded_no_subs').length;
  const subsFixes = results.filter(r => r.outcome === 'subs_recovered' || r.outcome === 'subs_swapped').length;
  const failed = results.filter(r => r.outcome === 'failed').length;

  let parts = [];
  if (downloaded > 0) parts.push(`${downloaded} downloaded`);
  if (subsFixes > 0) parts.push(`${subsFixes} subs fixed`);
  if (failed > 0) parts.push(`${failed} failed`);
  const summary = parts.length > 0 ? parts.join(', ') : 'no changes';

  const subject = `WatchOffline Report — ${date} (${summary})`;
  const html = buildReportHtml(results);
  await sendReport(subject, html);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

cron.schedule('0 7 * * *', () => {
  console.log('[episodeChecker] Cron triggered at 07:00');
  runEpisodeCheck();
});

console.log('[episodeChecker] Scheduled daily check at 07:00');

module.exports = { runEpisodeCheck };
