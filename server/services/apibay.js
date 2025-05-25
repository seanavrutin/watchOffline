const axios = require('axios');

class Apibay {
  static async search(query) {
    const res = await axios.get(`https://apibay.org/q.php?q=${encodeURIComponent(query)}&cat=0`);
    return res.data.filter(i => i.name && i.info_hash).map(i => ({
      name: i.name,
      size: `${(i.size / 1024 / 1024).toFixed(2)} MiB`,
      seeders: i.seeders,
      leechers: i.leechers,
      imdb: i.imdb,
      magnetLink: `magnet:?xt=urn:btih:${i.info_hash}&dn=${encodeURIComponent(i.name)}`
    }));
  }
}

module.exports = Apibay;
