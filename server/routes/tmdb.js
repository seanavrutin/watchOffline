const express = require('express');
const axios = require('axios');
const router = express.Router();

const TMDB_API_KEY = process.env.TMDB_API_KEY;

router.get('/search', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Missing query' });

  try {
    const response = await axios.get('https://api.themoviedb.org/3/search/multi', {
      params: {
        api_key: TMDB_API_KEY,
        query,
      },
    });

    const results = response.data.results
      .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
      .map((item) => ({
        id: item.id,
        title: item.title || item.name,
        year: (item.release_date || item.first_air_date || '').split('-')[0],
        type: item.media_type,
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w92${item.poster_path}` : null,
      }));

    res.json(results);
  } catch (err) {
    console.error('TMDb API error:', err.message);
    res.status(500).json({ error: 'Failed to fetch from TMDb' });
  }
});

module.exports = router;
