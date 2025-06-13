import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

export const searchTorrentsAndSubs = async (title, isSeries, season, episode, tmdbId) => {
  const params = new URLSearchParams({ title });

  if (tmdbId) {
    params.append('tmdbId', tmdbId);
  }
  if (isSeries) {
    if (season) params.append('season', season);
    if (episode) params.append('episode', episode);
  }

  const url = `${API_BASE_URL}/search?${params.toString()}`;
  const res = await axios.get(url);
  return res.data;
};


export const downloadSubtitleForOpenSubtitles = async (file_id, release) => {
    try {
      const res = await fetch(`${API_BASE_URL}/downloadSub/openSubtitles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id }),
      });

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = release + '.srt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Subtitle download failed:', err);
    }
};

export const downloadSubtitleForKtuvit = async (filmID,ktuvit_id,release) => {
  try {
    const res = await fetch(`${API_BASE_URL}/downloadSub/ktuvit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filmID,ktuvit_id,release }),
      responseType: 'blob'
    });

    const blob = new Blob([res.data], { type: 'application/octet-stream' });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = release + '.srt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Subtitle download failed:', err);
  }
};


export const searchTmdb = async (query) => {
    const res = await axios.get(`${API_BASE_URL}/tmdb/search?q=${encodeURIComponent(query)}`);
    return res.data;
  };
