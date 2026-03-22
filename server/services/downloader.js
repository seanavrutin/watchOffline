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

async function findAndDownloadEpisode({ title, tmdbId, imdbId, season, episode }) {
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
  const selected = withHebrew.length > 0 ? withHebrew[0] : null;

  if (!selected) {
    console.log(`[downloader] No torrent with Hebrew subs found for ${query}`);
    return { success: false, reason: 'no_hebrew_subs', torrentsFound: torrents.length };
  }

  console.log(`[downloader] Selected: ${selected.title} (seeders: ${selected.seeders}, subScore: ${selected.subScore})`);

  const cookie = await qbt.login();
  await qbt.addTorrent(cookie, selected.magnetLink, 'TV Shows');

  let savedSubs = [];
  if (selected.subtitles && selected.infoHash) {
    const files = await qbt.waitForFiles(cookie, selected.infoHash);
    if (files) {
      const videoFile = qbt.findVideoFile(files);
      if (videoFile) {
        const fullVideoPath = path.join(DROPZONE_PATH, 'TV Shows', videoFile.name);
        const videoDir = path.dirname(fullVideoPath);
        const videoBaseName = path.basename(videoFile.name).replace(/\.[^.]+$/, '');

        fs.mkdirSync(videoDir, { recursive: true });

        const langSuffix = { he: 'heb', en: 'eng' };
        for (const [lang, sub] of Object.entries(selected.subtitles)) {
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
      }
    }
  }

  return {
    success: true,
    torrentName: selected.title,
    infoHash: selected.infoHash,
    seeders: selected.seeders,
    subScore: selected.subScore,
    subtitlesSaved: savedSubs,
  };
}

module.exports = { findAndDownloadEpisode };
