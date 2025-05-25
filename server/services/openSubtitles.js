const axios = require('axios');

const BASE_URL = 'https://api.opensubtitles.com/api/v1';
const HEADERS = {
  'Api-Key': process.env.OPENSUBTITLES_API_KEY,
  'User-Agent': process.env.USER_AGENT
};

class OpenSubtitles {
  static async search(imdbId, season, episode) {
    let url = `${BASE_URL}/subtitles?imdb_id=${imdbId}&languages=he,en`;
    if (season) url += `&season_number=${season}`;
    if (episode) url += `&episode_number=${episode}`;

    const res = await axios.get(url, { headers: HEADERS });
    return res.data.data;
  }

  static async download(fileId) {
    const url = `${BASE_URL}/download`;
    const res = await axios.post(url, { file_id: fileId }, {
        headers: {
            'Api-Key': process.env.OPENSUBTITLES_API_KEY,
            'User-Agent': process.env.USER_AGENT,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
    });
    return res.data;
  }
}

module.exports = OpenSubtitles;