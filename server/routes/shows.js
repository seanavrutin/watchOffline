const express = require('express');
const router = express.Router();
const { db } = require('../firebase');
const { requireAuth } = require('../middleware/auth');
const { getTvInfo, getImdbIdFromTmdbId, getSeasonDetails } = require('../services/tmdb');
const qbt = require('../services/qbittorrent');
const { findAndDownloadEpisode } = require('../services/downloader');

const SHOWS_COLLECTION = 'shows';

router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection(SHOWS_COLLECTION).orderBy('addedAt', 'desc').get();
    const shows = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(shows);
  } catch (err) {
    console.error('Failed to fetch shows:', err.message);
    res.status(500).json({ error: 'Failed to fetch shows' });
  }
});

router.get('/:tmdbId', async (req, res) => {
  try {
    const doc = await db.collection(SHOWS_COLLECTION).doc(req.params.tmdbId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Show not found' });
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    console.error('Failed to fetch show:', err.message);
    res.status(500).json({ error: 'Failed to fetch show' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { tmdbId } = req.body;
  if (!tmdbId) {
    return res.status(400).json({ error: 'Missing tmdbId' });
  }

  try {
    const existing = await db.collection(SHOWS_COLLECTION).doc(String(tmdbId)).get();
    if (existing.exists) {
      return res.status(409).json({ error: 'Show already saved' });
    }

    const tvInfo = await getTvInfo(tmdbId);
    if (!tvInfo || tvInfo.error) {
      return res.status(404).json({ error: 'Show not found on TMDb' });
    }

    const showData = {
      tmdbId: tvInfo.id,
      title: tvInfo.name,
      posterPath: tvInfo.poster_path
        ? `https://image.tmdb.org/t/p/w500${tvInfo.poster_path}`
        : null,
      backdropPath: tvInfo.backdrop_path
        ? `https://image.tmdb.org/t/p/w780${tvInfo.backdrop_path}`
        : null,
      overview: tvInfo.overview || '',
      genres: (tvInfo.genres || []).map(g => g.name),
      status: tvInfo.status || 'Unknown',
      firstAirDate: tvInfo.first_air_date || null,
      numberOfSeasons: tvInfo.number_of_seasons || 0,
      numberOfEpisodes: tvInfo.number_of_episodes || 0,
      voteAverage: tvInfo.vote_average || 0,
      networks: (tvInfo.networks || []).map(n => n.name),
      seasons: (tvInfo.seasons || []).map(s => ({
        seasonNumber: s.season_number,
        episodeCount: s.episode_count,
        name: s.name,
        airDate: s.air_date || null,
        posterPath: s.poster_path
          ? `https://image.tmdb.org/t/p/w300${s.poster_path}`
          : null,
      })),
      addedAt: new Date().toISOString(),
      addedBy: req.user.name,
    };

    await db.collection(SHOWS_COLLECTION).doc(String(tmdbId)).set(showData);
    res.status(201).json({ id: String(tmdbId), ...showData });
  } catch (err) {
    console.error('Failed to add show:', err.message);
    res.status(500).json({ error: 'Failed to add show' });
  }
});

router.get('/:tmdbId/status', async (req, res) => {
  try {
    const doc = await db.collection(SHOWS_COLLECTION).doc(req.params.tmdbId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Show not found' });
    }
    const show = doc.data();

    let torrents = [];
    try {
      const cookie = await qbt.login();
      const allTorrents = await qbt.getTorrents(cookie);
      torrents = allTorrents;
    } catch (err) {
      console.error('qBittorrent unavailable:', err.message);
    }

    const titleNorm = show.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const matchingTorrents = torrents.filter(t => {
      const nameNorm = t.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return nameNorm.includes(titleNorm);
    });

    const episodeStatusMap = {};
    for (const t of matchingTorrents) {
      const parsed = qbt.parseEpisodeFromName(t.name);
      if (!parsed) continue;
      const key = `S${String(parsed.season).padStart(2, '0')}E${String(parsed.episode).padStart(2, '0')}`;
      const isComplete = t.progress >= 1;
      const existing = episodeStatusMap[key];
      if (!existing || (isComplete && existing.status !== 'downloaded')) {
        episodeStatusMap[key] = {
          status: isComplete ? 'downloaded' : 'downloading',
          progress: Math.round(t.progress * 100),
          torrentName: t.name,
        };
      }
    }

    const validSeasons = (show.seasons || []).filter(s => s.seasonNumber > 0);
    const today = new Date().toISOString().split('T')[0];

    const seasons = await Promise.all(validSeasons.map(async (season) => {
      let tmdbEpisodes = [];
      try {
        const seasonData = await getSeasonDetails(show.tmdbId, season.seasonNumber);
        if (seasonData?.episodes) {
          tmdbEpisodes = seasonData.episodes;
        }
      } catch (err) {
        console.error(`Failed to fetch season ${season.seasonNumber} details:`, err.message);
      }

      const episodes = Array.from({ length: season.episodeCount }, (_, i) => {
        const epNum = i + 1;
        const key = `S${String(season.seasonNumber).padStart(2, '0')}E${String(epNum).padStart(2, '0')}`;
        const match = episodeStatusMap[key];
        const tmdbEp = tmdbEpisodes.find(e => e.episode_number === epNum);
        const airDate = tmdbEp?.air_date || null;
        const aired = airDate ? airDate <= today : false;

        let status;
        if (match?.status) {
          status = match.status;
        } else if (!aired) {
          status = 'not_aired';
        } else {
          status = 'missing';
        }

        return {
          episodeNumber: epNum,
          key,
          name: tmdbEp?.name || null,
          airDate,
          aired,
          status,
          progress: match?.progress || 0,
          torrentName: match?.torrentName || null,
        };
      });

      return {
        seasonNumber: season.seasonNumber,
        episodeCount: season.episodeCount,
        name: season.name,
        episodes,
      };
    }));

    res.json({ tmdbId: show.tmdbId, title: show.title, trackedSeasons: show.trackedSeasons || [], seasons });
  } catch (err) {
    console.error('Failed to get show status:', err.message);
    res.status(500).json({ error: 'Failed to get show status' });
  }
});

router.post('/:tmdbId/download', requireAuth, async (req, res) => {
  const { season, episode } = req.body;
  if (!season || !episode) {
    return res.status(400).json({ error: 'Missing season or episode' });
  }

  try {
    const doc = await db.collection(SHOWS_COLLECTION).doc(req.params.tmdbId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Show not found' });
    }
    const show = doc.data();

    let imdbId = null;
    try {
      imdbId = await getImdbIdFromTmdbId(show.tmdbId, 'tv');
    } catch (err) {
      console.error('Failed to resolve IMDb ID:', err.message);
    }

    const result = await findAndDownloadEpisode({
      title: show.title,
      tmdbId: show.tmdbId,
      imdbId,
      season,
      episode,
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json({ error: result.reason === 'no_hebrew_subs'
        ? `No torrent with Hebrew subs found (${result.torrentsFound || 0} torrents checked)`
        : 'No suitable torrents found'
      });
    }
  } catch (err) {
    console.error('Failed to download episode:', err.message);
    res.status(500).json({ error: 'Failed to download episode' });
  }
});

router.put('/:tmdbId/track', requireAuth, async (req, res) => {
  const { season, tracked } = req.body;
  if (season === undefined || tracked === undefined) {
    return res.status(400).json({ error: 'Missing season or tracked' });
  }

  try {
    const docRef = db.collection(SHOWS_COLLECTION).doc(req.params.tmdbId);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Show not found' });
    }

    const data = doc.data();
    let trackedSeasons = data.trackedSeasons || [];

    if (tracked && !trackedSeasons.includes(season)) {
      trackedSeasons.push(season);
      trackedSeasons.sort((a, b) => a - b);
    } else if (!tracked) {
      trackedSeasons = trackedSeasons.filter(s => s !== season);
    }

    await docRef.update({ trackedSeasons });
    res.json({ trackedSeasons });
  } catch (err) {
    console.error('Failed to update tracking:', err.message);
    res.status(500).json({ error: 'Failed to update tracking' });
  }
});

router.post('/check-all', requireAuth, async (req, res) => {
  try {
    const { runEpisodeCheck } = require('../jobs/episodeChecker');
    res.json({ message: 'Episode check started' });
    runEpisodeCheck();
  } catch (err) {
    console.error('Failed to trigger episode check:', err.message);
    res.status(500).json({ error: 'Failed to trigger episode check' });
  }
});

router.delete('/:tmdbId', requireAuth, async (req, res) => {
  try {
    const doc = await db.collection(SHOWS_COLLECTION).doc(req.params.tmdbId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Show not found' });
    }
    await db.collection(SHOWS_COLLECTION).doc(req.params.tmdbId).delete();
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete show:', err.message);
    res.status(500).json({ error: 'Failed to delete show' });
  }
});

module.exports = router;
