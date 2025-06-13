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

    if (tmdbId) {
      const mediaType = isSeries ? 'tv' : 'movie';
      imdbIdFilter = await getImdbIdFromTmdbId(tmdbId, mediaType);
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
      allSubs.push(...ktuvitSubs);
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