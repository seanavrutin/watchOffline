const Apibay = require('./apibay');
const OpenSubtitles = require('./openSubtitles');
const Ktuvit = require('./ktuvit');
const matchSubtitles = require('../utils/matchSubtitles');
const { getImdbIdFromTmdbId } = require('./tmdb');
const qbt = require('./qbittorrent');
const fs = require('fs');
const path = require('path');
const https = require('https');
const iconv = require('iconv-lite');

const DROPZONE_PATH = process.env.DROPZONE_PATH || '/dropzone';
const MIN_SEEDERS = 3;
const MAX_SIZE_MB = 5000;

async function fetchOpenSubtitleData(file_id) {
  const result = await OpenSubtitles.download(file_id);
  const { link: downloadLink } = result;

  return new Promise((resolve, reject) => {
    https.get(downloadLink, (fileRes) => {
      let data = [];
      fileRes.on('data', (chunk) => data.push(chunk));
      fileRes.on('end', () => {
        const buffer = Buffer.concat(data);
        const converted = iconv.encode(buffer.toString('utf8'), 'win1255');
        resolve(converted);
      });
    }).on('error', reject);
  });
}

async function fetchKtuvitData(filmID, ktuvit_id) {
  const response = await Ktuvit.downloadSubtitle(filmID, ktuvit_id);
  return response.data;
}

async function fetchSubtitleData(sub) {
  if (sub.file_id) return fetchOpenSubtitleData(sub.file_id);
  if (sub.ktuvit_id) return fetchKtuvitData(sub.filmID, sub.ktuvit_id);
  return null;
}

async function searchSubtitles(imdbId, title, paddedSeason, paddedEpisode) {
  let allSubs = [];
  if (imdbId) {
    try {
      allSubs = await OpenSubtitles.search(imdbId, paddedSeason, paddedEpisode);
    } catch (err) {
      console.error('[downloader] OpenSubtitles search failed:', err.message);
    }
    try {
      const ktuvitSubs = await Ktuvit.getSubtitles(imdbId, title, null, paddedSeason, paddedEpisode, true);
      if (ktuvitSubs) allSubs.push(...ktuvitSubs);
    } catch (err) {
      console.error('[downloader] Ktuvit search failed:', err.message);
    }
  }
  return allSubs;
}

async function saveSubtitles(cookie, infoHash, subtitles) {
  let savedSubs = [];
  if (!subtitles || !infoHash) return savedSubs;

  const files = await qbt.waitForFiles(cookie, infoHash);
  if (!files) return savedSubs;

  const videoFile = qbt.findVideoFile(files);
  if (!videoFile) return savedSubs;

  const fullVideoPath = path.join(DROPZONE_PATH, 'TV Shows', videoFile.name);
  const videoDir = path.dirname(fullVideoPath);
  const videoBaseName = path.basename(videoFile.name).replace(/\.[^.]+$/, '');

  fs.mkdirSync(videoDir, { recursive: true });

  const langSuffix = { he: 'heb', en: 'eng' };
  for (const [lang, sub] of Object.entries(subtitles)) {
    try {
      const data = await fetchSubtitleData(sub);
      if (data) {
        const suffix = langSuffix[lang] || lang;
        const subFilename = `${videoBaseName}.${suffix}.srt`;
        const subPath = path.join(videoDir, subFilename);
        fs.writeFileSync(subPath, data);
        savedSubs.push(subFilename);
      }
    } catch (err) {
      console.error(`[downloader] Failed to save ${lang} subtitle:`, err.message);
    }
  }
  return savedSubs;
}

async function findAndDownloadEpisode({ title, tmdbId, imdbId, season, episode, requireHebrewSubs = true }) {
  const paddedSeason = String(season).padStart(2, '0');
  const paddedEpisode = String(episode).padStart(2, '0');

  if (!imdbId && tmdbId) {
    imdbId = await getImdbIdFromTmdbId(tmdbId, 'tv');
  }

  const query = `${title} s${paddedSeason}e${paddedEpisode}`;
  console.log(`[downloader] Searching: ${query}`);

  let torrents = await Apibay.search(query);

  if (imdbId) {
    torrents = torrents.filter(t => t.imdb === imdbId || t.imdb === '');
  }

  const sizeMB = (sizeStr) => parseFloat(sizeStr) || 0;
  torrents = torrents.filter(t =>
    parseInt(t.seeders, 10) >= MIN_SEEDERS &&
    sizeMB(t.size) <= MAX_SIZE_MB
  );

  if (torrents.length === 0) {
    console.log('[downloader] No torrents pass filter');
    return { success: false, reason: 'no_torrents' };
  }

  const allSubs = await searchSubtitles(imdbId, title, paddedSeason, paddedEpisode);
  const torrentsWithSubs = matchSubtitles(torrents, allSubs);

  const maxSeeders = Math.max(...torrentsWithSubs.map(t => parseInt(t.seeders, 10) || 0), 1);

  const scored = torrentsWithSubs.map(t => {
    const hebrewSub = t.subtitles?.he;
    const subScore = hebrewSub?.matchScore || 0;
    const seedersNorm = (parseInt(t.seeders, 10) || 0) / maxSeeders;
    const totalScore = (subScore * 0.6) + (seedersNorm * 0.4);
    return { ...t, subScore, totalScore, hasHebrewSub: subScore >= 0.75 };
  });

  scored.sort((a, b) => b.totalScore - a.totalScore);

  const withHebrew = scored.filter(t => t.hasHebrewSub);
  let selected = withHebrew.length > 0 ? withHebrew[0] : null;

  if (!selected && requireHebrewSubs) {
    console.log(`[downloader] No torrent with Hebrew subs found for ${query}`);
    return { success: false, reason: 'no_hebrew_subs', torrentsFound: torrents.length };
  }

  if (!selected) {
    const bySeedersThenScore = [...scored].sort((a, b) => {
      const seedDiff = (parseInt(b.seeders, 10) || 0) - (parseInt(a.seeders, 10) || 0);
      return seedDiff !== 0 ? seedDiff : b.totalScore - a.totalScore;
    });
    selected = bySeedersThenScore[0];
    console.log(`[downloader] No Hebrew subs available, selecting best torrent: ${selected.title} (seeders: ${selected.seeders})`);
  } else {
    console.log(`[downloader] Selected: ${selected.title} (seeders: ${selected.seeders}, subScore: ${selected.subScore})`);
  }

  const cookie = await qbt.login();
  await qbt.addTorrent(cookie, selected.magnetLink, 'TV Shows');

  const savedSubs = await saveSubtitles(cookie, selected.infoHash, selected.subtitles);
  const hebrewSubSaved = savedSubs.some(f => f.includes('.heb.'));

  return {
    success: true,
    torrentName: selected.title,
    infoHash: selected.infoHash,
    seeders: selected.seeders,
    subScore: selected.subScore,
    subtitlesSaved: savedSubs,
    hebrewSubSaved,
  };
}

async function recheckMissingSubs({ title, imdbId, season, episode, torrentHash, torrentName }) {
  const paddedSeason = String(season).padStart(2, '0');
  const paddedEpisode = String(episode).padStart(2, '0');
  const key = `S${paddedSeason}E${paddedEpisode}`;

  console.log(`[downloader] Rechecking Hebrew subs for ${title} ${key}`);

  const allSubs = await searchSubtitles(imdbId, title, paddedSeason, paddedEpisode);

  if (allSubs.length === 0) {
    console.log(`[downloader] No subs found at all for ${title} ${key}`);
    return { outcome: 'subs_still_missing' };
  }

  const currentAsFakeTorrent = [{ id: torrentHash, infoHash: torrentHash, name: torrentName, size: '0', seeders: '0', leechers: '0', magnetLink: '' }];
  const matched = matchSubtitles(currentAsFakeTorrent, allSubs);
  const currentMatch = matched[0];
  const currentHebScore = currentMatch?.subtitles?.he?.matchScore || 0;

  if (currentHebScore >= 0.75) {
    console.log(`[downloader] Hebrew subs now match current torrent (score: ${currentHebScore})`);
    const cookie = await qbt.login();
    const savedSubs = await saveSubtitles(cookie, torrentHash, currentMatch.subtitles);
    const hebrewSubSaved = savedSubs.some(f => f.includes('.heb.'));

    if (hebrewSubSaved) {
      return { outcome: 'subs_recovered', subtitlesSaved: savedSubs };
    }
    return { outcome: 'subs_still_missing', reason: 'Sub matched but failed to save' };
  }

  console.log(`[downloader] Current torrent doesn't match subs (score: ${currentHebScore}), searching for alternative`);

  let torrents = await Apibay.search(`${title} s${paddedSeason}e${paddedEpisode}`);
  if (imdbId) {
    torrents = torrents.filter(t => t.imdb === imdbId || t.imdb === '');
  }
  const sizeMB = (sizeStr) => parseFloat(sizeStr) || 0;
  torrents = torrents.filter(t =>
    parseInt(t.seeders, 10) >= MIN_SEEDERS &&
    sizeMB(t.size) <= MAX_SIZE_MB &&
    t.infoHash !== torrentHash
  );

  if (torrents.length === 0) {
    console.log(`[downloader] No alternative torrents found`);
    return { outcome: 'subs_still_missing' };
  }

  const torrentsWithSubs = matchSubtitles(torrents, allSubs);
  const maxSeeders = Math.max(...torrentsWithSubs.map(t => parseInt(t.seeders, 10) || 0), 1);

  const scored = torrentsWithSubs.map(t => {
    const hebrewSub = t.subtitles?.he;
    const subScore = hebrewSub?.matchScore || 0;
    const seedersNorm = (parseInt(t.seeders, 10) || 0) / maxSeeders;
    const totalScore = (subScore * 0.6) + (seedersNorm * 0.4);
    return { ...t, subScore, totalScore, hasHebrewSub: subScore >= 0.75 };
  });

  scored.sort((a, b) => b.totalScore - a.totalScore);
  const best = scored.find(t => t.hasHebrewSub);

  if (!best) {
    console.log(`[downloader] No alternative torrent with Hebrew subs found`);
    return { outcome: 'subs_still_missing' };
  }

  console.log(`[downloader] Swapping to: ${best.title} (seeders: ${best.seeders}, subScore: ${best.subScore})`);

  const cookie = await qbt.login();
  await qbt.deleteTorrent(cookie, torrentHash, true);
  await qbt.addTorrent(cookie, best.magnetLink, 'TV Shows');

  const savedSubs = await saveSubtitles(cookie, best.infoHash, best.subtitles);
  const hebrewSubSaved = savedSubs.some(f => f.includes('.heb.'));

  return {
    outcome: hebrewSubSaved ? 'subs_swapped' : 'subs_still_missing',
    newTorrentName: best.title,
    newInfoHash: best.infoHash,
    seeders: best.seeders,
    subScore: best.subScore,
    subtitlesSaved: savedSubs,
  };
}

async function findAndDownloadSeason({ title, tmdbId, imdbId, season }) {
  const paddedSeason = String(season).padStart(2, '0');

  if (!imdbId && tmdbId) {
    imdbId = await getImdbIdFromTmdbId(tmdbId, 'tv');
  }

  const queries = [
    `${title} s${paddedSeason}`,
    `${title} season ${season}`,
  ];

  const epPattern = /s\d{2}e\d{2}/i;
  const MAX_SEASON_SIZE_MB = 50000;
  let allTorrents = [];

  for (const query of queries) {
    console.log(`[downloader] Season search: ${query}`);
    const results = await Apibay.search(query);
    allTorrents.push(...results);
  }

  const seen = new Set();
  allTorrents = allTorrents.filter(t => {
    if (seen.has(t.infoHash)) return false;
    seen.add(t.infoHash);
    return true;
  });

  allTorrents = allTorrents.filter(t => !epPattern.test(t.name));

  if (imdbId) {
    allTorrents = allTorrents.filter(t => t.imdb === imdbId || t.imdb === '');
  }

  const sizeMB = (sizeStr) => parseFloat(sizeStr) || 0;
  allTorrents = allTorrents.filter(t =>
    parseInt(t.seeders, 10) >= MIN_SEEDERS &&
    sizeMB(t.size) <= MAX_SEASON_SIZE_MB
  );

  if (allTorrents.length === 0) {
    console.log('[downloader] No season pack torrents found');
    return { success: false, reason: 'no_torrents' };
  }

  allTorrents.sort((a, b) => (parseInt(b.seeders, 10) || 0) - (parseInt(a.seeders, 10) || 0));
  const selected = allTorrents[0];

  console.log(`[downloader] Selected season pack: ${selected.name} (seeders: ${selected.seeders}, size: ${selected.size})`);

  const cookie = await qbt.login();
  await qbt.addTorrent(cookie, selected.magnetLink, 'TV Shows');

  return {
    success: true,
    torrentName: selected.name,
    infoHash: selected.infoHash,
    seeders: selected.seeders,
    size: selected.size,
  };
}

module.exports = { findAndDownloadEpisode, recheckMissingSubs, findAndDownloadSeason };
