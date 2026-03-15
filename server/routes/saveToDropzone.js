const express = require('express');
const https = require('https');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const OpenSubtitles = require('../services/openSubtitles');
const Ktuvit = require('../services/ktuvit');
const iconv = require('iconv-lite');
const router = express.Router();

const DROPZONE_PATH = process.env.DROPZONE_PATH || '/dropzone';
const VIDEO_EXTENSIONS = ['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm'];

const sanitizeFilename = (name) => {
  return name.replace(/[^a-zA-Z0-9._\-\s\[\]()]/g, '').substring(0, 200);
};

// --- qBittorrent helpers ---

function getQbtConfig() {
  return {
    url: process.env.QBITTORRENT_URL || 'http://localhost:8080',
    user: process.env.QBITTORRENT_USER || 'admin',
    pass: process.env.QBITTORRENT_PASS || 'adminadmin',
  };
}

async function qbtLogin() {
  const { url, user, pass } = getQbtConfig();
  const res = await axios.post(
    `${url}/api/v2/auth/login`,
    `username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return res.headers['set-cookie']?.[0] || '';
}

async function qbtEnsureCategory(cookie, category) {
  const { url } = getQbtConfig();
  try {
    await axios.post(
      `${url}/api/v2/torrents/createCategory`,
      `category=${encodeURIComponent(category)}`,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookie } }
    );
  } catch (e) {
    // 409 = category already exists, which is fine
    if (e.response?.status !== 409) throw e;
  }
}

async function qbtAddTorrent(cookie, magnetLink, category) {
  const { url } = getQbtConfig();
  let body = `urls=${encodeURIComponent(magnetLink)}`;
  if (category) {
    await qbtEnsureCategory(cookie, category);
    body += `&category=${encodeURIComponent(category)}`;
  }
  await axios.post(
    `${url}/api/v2/torrents/add`,
    body,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookie } }
  );
}

async function qbtGetFiles(cookie, hash) {
  const { url } = getQbtConfig();
  const res = await axios.get(
    `${url}/api/v2/torrents/files?hash=${hash.toLowerCase()}`,
    { headers: { 'Cookie': cookie } }
  );
  return res.data;
}

async function waitForFiles(cookie, hash, maxAttempts = 15, intervalMs = 2000) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const files = await qbtGetFiles(cookie, hash);
      if (files && files.length > 0 && files[0].name !== '') return files;
    } catch (e) { /* metadata not ready */ }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  return null;
}

function findVideoFile(files) {
  return files
    .filter(f => VIDEO_EXTENSIONS.some(ext => f.name.toLowerCase().endsWith(ext)))
    .sort((a, b) => b.size - a.size)[0];
}

// --- Subtitle fetch helpers ---

async function fetchOpenSubtitle(file_id) {
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

async function fetchKtuvitSubtitle(filmID, ktuvit_id) {
  const response = await Ktuvit.downloadSubtitle(filmID, ktuvit_id);
  return response.data;
}

async function fetchSubtitle(sub) {
  if (sub.file_id) return fetchOpenSubtitle(sub.file_id);
  if (sub.ktuvit_id) return fetchKtuvitSubtitle(sub.filmID, sub.ktuvit_id);
  return null;
}

// --- Routes ---

router.post('/subtitle/openSubtitles', async (req, res) => {
  try {
    const { file_id, release } = req.body;
    const data = await fetchOpenSubtitle(file_id);
    const filename = sanitizeFilename(release) + '.srt';
    const filePath = path.join(DROPZONE_PATH, filename);

    fs.writeFile(filePath, data, (err) => {
      if (err) {
        console.error('Failed to write subtitle to dropzone:', err);
        return res.status(500).json({ error: 'Failed to save file' });
      }
      res.json({ success: true, filename });
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to get subtitle' });
  }
});

router.post('/subtitle/ktuvit', async (req, res) => {
  try {
    const { filmID, ktuvit_id, release } = req.body;
    const data = await fetchKtuvitSubtitle(filmID, ktuvit_id);
    const filename = sanitizeFilename(release) + '.srt';
    const filePath = path.join(DROPZONE_PATH, filename);

    fs.writeFile(filePath, data, (err) => {
      if (err) {
        console.error('Failed to write subtitle to dropzone:', err);
        return res.status(500).json({ error: 'Failed to save file' });
      }
      res.json({ success: true, filename });
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to get subtitle' });
  }
});

router.get('/torrents', async (req, res) => {
  try {
    const cookie = await qbtLogin();
    const { url } = getQbtConfig();
    const response = await axios.get(
      `${url}/api/v2/torrents/info`,
      { headers: { 'Cookie': cookie } }
    );
    const torrents = response.data.map(t => ({
      hash: t.hash,
      name: t.name,
      size: t.size,
      progress: t.progress,
      state: t.state,
      dlspeed: t.dlspeed,
      eta: t.eta,
    }));
    res.json(torrents);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to get torrents' });
  }
});

router.delete('/torrent/:hash', async (req, res) => {
  try {
    const { hash } = req.params;
    const cookie = await qbtLogin();
    const { url } = getQbtConfig();
    await axios.post(
      `${url}/api/v2/torrents/delete`,
      `hashes=${hash}&deleteFiles=true`,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookie } }
    );
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete torrent' });
  }
});

router.post('/torrent', async (req, res) => {
  try {
    const { magnetLink, infoHash, name, subtitles, isSeries } = req.body;
    if (!magnetLink) {
      return res.status(400).json({ error: 'Missing magnet link' });
    }

    const category = isSeries ? 'TV Shows' : 'Movies';
    const cookie = await qbtLogin();
    await qbtAddTorrent(cookie, magnetLink, category);

    const savedSubs = [];
    const hasSubtitles = subtitles && infoHash && Object.keys(subtitles).length > 0;

    if (hasSubtitles) {
      const files = await waitForFiles(cookie, infoHash);

      if (files) {
        const videoFile = findVideoFile(files);

        if (videoFile) {
          const categoryFolder = isSeries ? 'TV Shows' : 'Movies';
          const fullVideoPath = path.join(DROPZONE_PATH, categoryFolder, videoFile.name);
          const videoDir = path.dirname(fullVideoPath);
          const videoBaseName = path.basename(videoFile.name).replace(/\.[^.]+$/, '');

          fs.mkdirSync(videoDir, { recursive: true });

          const langSuffix = { he: 'heb', en: 'eng' };

          for (const [lang, sub] of Object.entries(subtitles)) {
            try {
              const data = await fetchSubtitle(sub);
              if (data) {
                const suffix = langSuffix[lang] || lang;
                const subFilename = `${videoBaseName}.${suffix}.srt`;
                const subPath = path.join(videoDir, subFilename);
                fs.writeFileSync(subPath, data);
                savedSubs.push(subFilename);
              }
            } catch (err) {
              console.error(`Failed to save ${lang} subtitle:`, err);
            }
          }
        }
      }
    }

    const displayName = sanitizeFilename(name || 'torrent');
    res.json({
      success: true,
      filename: displayName,
      subtitlesSaved: savedSubs,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to add torrent to qBittorrent' });
  }
});

module.exports = router;
