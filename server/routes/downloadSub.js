const express = require('express');
const https = require('https');
const OpenSubtitles = require('../services/openSubtitles');
const Ktuvit = require('../services/ktuvit');
const router = express.Router();

router.post('/openSubtitles', async (req, res) => {
  const { file_id } = req.body;
  if (!file_id) return res.status(400).send('Missing file_id');

  try {
    const result = await OpenSubtitles.download(file_id);

    const { link: downloadLink, file_name } = result;

    res.setHeader('Content-Disposition', `attachment; filename="${file_name}"`);
    res.setHeader('Content-Type', 'application/x-subrip');

    https.get(downloadLink, (fileRes) => {
      fileRes.pipe(res);
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
