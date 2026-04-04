const express = require('express');
const router = express.Router();
const Ktuvit = require('../services/ktuvit');
const Apibay = require('../services/apibay');
const OpenSubtitles = require('../services/openSubtitles');
const matchSubtitles = require('../utils/matchSubtitles');
const { getImdbIdFromTmdbId } = require('../services/tmdb');

router.get('/', async (req, res) => {
  let { title, season, episode, tmdbId, year } = req.query;
  if (!title) {
    return res.status(400).send('Missing required parameter: title');
  }
  try {

    title = title.replace("'","");
    let imdbIdFilter = null;
    const isSeries = season ? true : false;
    const isFullSeason = season && !episode;

    if (tmdbId) {
      const mediaType = isSeries ? 'tv' : 'movie';
      imdbIdFilter = await getImdbIdFromTmdbId(tmdbId, mediaType);
    }

    if (isFullSeason) {
      const paddedSeason = season.padStart(2, '0');
      const queries = [
        `${title} s${paddedSeason}`,
        `${title} season ${parseInt(season, 10)}`,
      ];

      const epPattern = /s\d{2}e\d{2}/i;
      let torrents = [];

      for (const query of queries) {
        const results = await Apibay.search(query);
        torrents.push(...results);
      }

      const seen = new Set();
      torrents = torrents.filter(t => {
        if (seen.has(t.infoHash)) return false;
        seen.add(t.infoHash);
        return true;
      });

      torrents = torrents.filter(t => !epPattern.test(t.name));

      const seasonNum = parseInt(season, 10);
      const seasonRegex = new RegExp(
        `(?:s0?${seasonNum}(?!\\d)|season\\s*0?${seasonNum}(?!\\d))`, 'i'
      );
      torrents = torrents.filter(t => seasonRegex.test(t.name));

      if (imdbIdFilter) {
        torrents = torrents.filter(t => t.imdb === imdbIdFilter || t.imdb === '');
      }

      const formatted = torrents.map(t => ({
        id: t.id,
        infoHash: t.infoHash,
        title: t.name,
        size: t.size,
        seeders: t.seeders,
        leechers: t.leechers,
        magnetLink: t.magnetLink,
        subtitles: {},
      }));

      return res.json({ torrents: formatted, subs: [] });
    }

    const query = season && episode
      ? `${title} s${season.padStart(2, '0')}e${episode.padStart(2, '0')}`
      : title;

    let torrents = await Apibay.search(query);
    let allSubs = [];

    if(imdbIdFilter){
      torrents = torrents.filter(t => t.imdb === imdbIdFilter || t.imdb === "");
      allSubs = await OpenSubtitles.search(imdbIdFilter, season, episode);
      let ktuvitSubs = await Ktuvit.getSubtitles(imdbIdFilter,title,year,season,episode,isSeries);
      if(ktuvitSubs){
        allSubs.push(...ktuvitSubs);
      }
    }
    else{
      const imdbIds = [...new Set(torrents.map(t => t.imdb).filter(Boolean))];
      for (const imdb of imdbIds) {
        const subs = await OpenSubtitles.search(imdb, season, episode);
        allSubs.push(...subs);
      }
    }

    let torrentsWithSubs = matchSubtitles(torrents, allSubs);
    let result = {};
    result.torrents = torrentsWithSubs;
    result.subs = allSubs
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;