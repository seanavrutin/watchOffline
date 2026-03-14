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

const sanitizeFilename = (name) => {
  return name.replace(/[^a-zA-Z0-9._\-\s\[\]()]/g, '').substring(0, 200);
};

router.post('/subtitle/openSubtitles', async (req, res) => {
  try {
    const { file_id, release } = req.body;
    const result = await OpenSubtitles.download(file_id);
    const { link: downloadLink, file_name } = result;

    https.get(downloadLink, (fileRes) => {
      let data = [];

      fileRes.on('data', (chunk) => data.push(chunk));

      fileRes.on('end', () => {
        const buffer = Buffer.concat(data);
        const converted = iconv.encode(buffer.toString('utf8'), 'win1255');
        const filename = sanitizeFilename(release || file_name) + '.srt';
        const filePath = path.join(DROPZONE_PATH, filename);

        fs.writeFile(filePath, converted, (err) => {
          if (err) {
            console.error('Failed to write subtitle to dropzone:', err);
            return res.status(500).json({ error: 'Failed to save file' });
          }
          res.json({ success: true, filename });
        });
      });
    }).on('error', (err) => {
      console.error('Stream error:', err);
      res.status(500).json({ error: 'Failed to download subtitle' });
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to get subtitle' });
  }
});

router.post('/subtitle/ktuvit', async (req, res) => {
  try {
    const { filmID, ktuvit_id, release } = req.body;
    const response = await Ktuvit.downloadSubtitle(filmID, ktuvit_id);
    const filename = sanitizeFilename(release) + '.srt';
    const filePath = path.join(DROPZONE_PATH, filename);

    fs.writeFile(filePath, response.data, (err) => {
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

router.post('/torrent', async (req, res) => {
  try {
    const { magnetLink, name } = req.body;
    if (!magnetLink) {
      return res.status(400).json({ error: 'Missing magnet link' });
    }

    const qbtUrl = process.env.QBITTORRENT_URL || 'http://localhost:8080';
    const qbtUser = process.env.QBITTORRENT_USER || 'admin';
    const qbtPass = process.env.QBITTORRENT_PASS || 'adminadmin';

    const loginRes = await axios.post(
      `${qbtUrl}/api/v2/auth/login`,
      `username=${encodeURIComponent(qbtUser)}&password=${encodeURIComponent(qbtPass)}`,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const cookie = loginRes.headers['set-cookie']?.[0];

    await axios.post(
      `${qbtUrl}/api/v2/torrents/add`,
      `urls=${encodeURIComponent(magnetLink)}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookie || '',
        },
      }
    );

    const filename = sanitizeFilename(name || 'torrent');
    res.json({ success: true, filename });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to add torrent to qBittorrent' });
  }
});

module.exports = router;
