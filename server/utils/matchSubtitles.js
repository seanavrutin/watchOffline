function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean);
}

module.exports = function matchSubtitlesMultiLang(videos, subtitles) {
  const releaseBoosts = ['yify', 'flux', 'gaz', 'lama'];
  const resolutionBoosts = ['1080p', '720p'];
  const codecBoosts = ['x264', 'x265', 'web-dl', 'brrip', 'bluray'];

  // Group subtitles by language
  const subsByLang = subtitles.reduce((acc, sub) => {
    const lang = sub.attributes.language;
    if (!acc[lang]) acc[lang] = [];
    acc[lang].push(sub);
    return acc;
  }, {});

  return videos.map(video => {
    const videoTokens = new Set(normalize(video.name));

    const subtitlesPerLang = {};

    for (const [lang, langSubs] of Object.entries(subsByLang)) {
      let bestMatch = null;
      let highestScore = 0;

      for (const sub of langSubs) {
        const release = sub.attributes.release;
        const subTokens = normalize(release);
        const intersection = subTokens.filter(token => videoTokens.has(token));
        const union = new Set([...videoTokens, ...subTokens]);
        let baseScore = intersection.length / union.size;

        // Boosts
        let boost = 0;
        const lowerRelease = release.toLowerCase();

        if (releaseBoosts.some(tag => lowerRelease.includes(tag))) boost += 0.1;
        if (resolutionBoosts.some(tag => lowerRelease.includes(tag))) boost += 0.06;
        if (codecBoosts.some(tag => lowerRelease.includes(tag))) boost += 0.05;
        if (release.toLowerCase().startsWith(normalize(video.name)[0])) boost += 0.05;

        const finalScore = Math.min(baseScore + boost, 1);

        if (finalScore > highestScore) {
          highestScore = finalScore;
          bestMatch = sub;
        }
      }

      if (bestMatch && highestScore >= 0.75) {
        subtitlesPerLang[lang] = {
          release: bestMatch.attributes.release,
          matchScore: Number(highestScore.toFixed(2)),
          file_id: bestMatch.attributes.files[0]?.file_id || null,
        };
      }
    }

    return {
      title: video.name,
      size: video.size,
      seeders: video.seeders,
      leechers: video.leechers,
      magnetLink: video.magnetLink,
      subtitles: subtitlesPerLang
    };
  });
};
