const express = require('express');
const https = require('https');
const OpenSubtitles = require('../services/openSubtitles');
const Ktuvit = require('../services/ktuvit');
const router = express.Router();
const iconv = require('iconv-lite');

router.post('/openSubtitles', async (req, res) => {
  try {
    const { file_id, release } = req.body;
    const result = await OpenSubtitles.download(file_id);
    const { link: downloadLink, file_name } = result;

    https.get(downloadLink, (fileRes) => {
      let data = [];

      fileRes.on('data', (chunk) => {
        data.push(chunk);
      });

      fileRes.on('end', () => {
        const buffer = Buffer.concat(data);
        const converted = iconv.encode(buffer.toString('utf8'), 'win1255');

        res.setHeader('Content-Disposition', `attachment; filename="${file_name}"`);
        res.setHeader('Content-Type', 'application/x-subrip; charset=windows-1255');
        res.send(converted);
      });
    }).on('error', (err) => {
      console.error('Stream error:', err);
      res.status(500).send('Failed to download subtitle');
    });
  } catch (e) {
    console.error(e);
    res.status(500).send('Failed to get subtitle');
  }
});

router.post('/ktuvit', async (req, res) => {
  const { filmID,ktuvit_id,release } = req.body;
  try{

    let response = await Ktuvit.downloadSubtitle(filmID,ktuvit_id);
    res.setHeader('Content-Disposition', `attachment; filename="${release}.srt"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    res.send(response.data);
  } catch (e) {
    console.error(e);
    res.status(500).send('Failed to get subtitle');
  }

});

module.exports = router;
