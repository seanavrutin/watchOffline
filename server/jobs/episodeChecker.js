const cron = require('node-cron');
const { db } = require('../firebase');
const { getSeasonDetails, getImdbIdFromTmdbId } = require('../services/tmdb');
const qbt = require('../services/qbittorrent');
const { findAndDownloadEpisode } = require('../services/downloader');
const { sendReport, buildReportHtml } = require('../services/mailer');

const SHOWS_COLLECTION = 'shows';

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

          if (!aired) {
            const daysUntil = airDate ? daysUntilAir(airDate) : null;
            results.push({
              outcome: 'not_aired',
              show: show.title,
              key,
              epName: ep.name || null,
              airInfo: daysUntil !== null ? `in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}` : 'TBA',
            });
            continue;
          }

          console.log(`[episodeChecker] Missing: ${show.title} ${key} — attempting download`);

          try {
            const result = await findAndDownloadEpisode({
              title: show.title,
              tmdbId: show.tmdbId,
              imdbId,
              season: seasonNum,
              episode: epNum,
            });

            if (result.success) {
              results.push({
                outcome: 'downloaded',
                show: show.title,
                key,
                epName: ep.name || null,
                torrentName: result.torrentName,
                seeders: result.seeders,
                subScore: result.subScore,
                subtitlesSaved: result.subtitlesSaved,
              });
            } else {
              const reason = result.reason === 'no_hebrew_subs'
                ? `No Hebrew subs (${result.torrentsFound || 0} torrents checked)`
                : 'No suitable torrents found';
              results.push({
                outcome: 'failed',
                show: show.title,
                key,
                epName: ep.name || null,
                reason,
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
    }
  } catch (err) {
    console.error('[episodeChecker] Fatal error:', err.message);
  }

  await sendDailyReport(results);
  console.log('[episodeChecker] Finished. Results:', results.length);
}

async function sendDailyReport(results) {
  const date = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  const downloaded = results.filter(r => r.outcome === 'downloaded').length;
  const failed = results.filter(r => r.outcome === 'failed').length;

  const subject = `WatchOffline Report — ${date} (${downloaded} downloaded, ${failed} failed)`;
  const html = buildReportHtml(results);
  await sendReport(subject, html);
}

function daysUntilAir(dateStr) {
  const airDate = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((airDate - now) / (1000 * 60 * 60 * 24));
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
