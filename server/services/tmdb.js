const axios = require('axios');
const TMDB_API_KEY = process.env.TMDB_API_KEY;

async function getImdbIdFromTmdbId(tmdbId, mediaType = 'movie') {
  try {
    const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
    const res = await axios.get(url);
    return res.data.imdb_id || null;
  } catch (err) {
    console.error('Failed to get IMDb ID from TMDb:', err.message);
    return null;
  }
}

async function getTvInfo(tmdbId) {
  try {
    const url = `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const res = await axios.get(url);
    return res.data || { error: 'Failed to get seasons data from TMDb' };
  } catch (err) {
    console.error('Failed to get seasons data from TMDb:', err.message);
    return undefined;
  }
}

module.exports = { getImdbIdFromTmdbId,getTvInfo };
