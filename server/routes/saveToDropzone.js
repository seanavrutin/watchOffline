const express = require('express');
const https = require('https');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const OpenSubtitles = require('../services/openSubtitles');
const Ktuvit = require('../services/ktuvit');
const iconv = require('iconv-lite');
const qbt = require('../services/qbittorrent');
const router = express.Router();

const DROPZONE_PATH = process.env.DROPZONE_PATH || '/dropzone';

const sanitizeFilename = (name) => {
  return name.replace(/[^a-zA-Z0-9._\-\s\[\]()]/g, '').substring(0, 200);
};

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
    const cookie = await qbt.login();
    const allTorrents = await qbt.getTorrents(cookie);
    const torrents = allTorrents.map(t => ({
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
    const cookie = await qbt.login();
    await qbt.deleteTorrent(cookie, hash);
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
    const cookie = await qbt.login();
    await qbt.addTorrent(cookie, magnetLink, category);

    const savedSubs = [];
    const hasSubtitles = subtitles && infoHash && Object.keys(subtitles).length > 0;

    if (hasSubtitles) {
      const files = await qbt.waitForFiles(cookie, infoHash);

      if (files) {
        const videoFile = qbt.findVideoFile(files);

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
