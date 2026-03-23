import axios from 'axios';
import { auth } from '../firebase';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

async function getAuthHeaders() {
  const user = auth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

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
      body: JSON.stringify({ filmID,ktuvit_id,release })
    });

    const arrayBuffer = await res.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
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


export const saveSubToDropzone = async ({ file_id, filmID, ktuvit_id, release }) => {
  const isOpenSub = !!file_id;
  const endpoint = isOpenSub
    ? '/dropzone/subtitle/openSubtitles'
    : '/dropzone/subtitle/ktuvit';

  const body = isOpenSub
    ? { file_id, release }
    : { filmID, ktuvit_id, release };

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error('Failed to save subtitle');
  return res.json();
};

export const saveTorrentToDropzone = async (magnetLink, infoHash, name, subtitles, isSeries) => {
  const res = await fetch(`${API_BASE_URL}/dropzone/torrent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ magnetLink, infoHash, name, subtitles, isSeries }),
  });

  if (!res.ok) throw new Error('Failed to save torrent');
  return res.json();
};

export const getDropzoneTorrents = async () => {
  const res = await fetch(`${API_BASE_URL}/dropzone/torrents`);
  if (!res.ok) throw new Error('Failed to get torrents');
  return res.json();
};

export const deleteDropzoneTorrent = async (hash) => {
  const res = await fetch(`${API_BASE_URL}/dropzone/torrent/${hash}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete torrent');
  return res.json();
};

export const searchTmdb = async (query) => {
  const res = await axios.get(`${API_BASE_URL}/tmdb/search?q=${encodeURIComponent(query)}`);
  return res.data;
};

export const getTvInfo = async (tmdbId) => {
  const res = await axios.get(`${API_BASE_URL}/tmdb/tvInfo?tmdbId=${tmdbId}`);
  return res.data;
};

export const getShows = async () => {
  const res = await axios.get(`${API_BASE_URL}/shows`);
  return res.data;
};

export const addShow = async (tmdbId) => {
  const headers = await getAuthHeaders();
  const res = await axios.post(`${API_BASE_URL}/shows`, { tmdbId }, { headers });
  return res.data;
};

export const removeShow = async (tmdbId) => {
  const headers = await getAuthHeaders();
  const res = await axios.delete(`${API_BASE_URL}/shows/${tmdbId}`, { headers });
  return res.data;
};

export const getShowStatus = async (tmdbId) => {
  const res = await axios.get(`${API_BASE_URL}/shows/${tmdbId}/status`);
  return res.data;
};

export const downloadEpisode = async (tmdbId, season, episode) => {
  const headers = await getAuthHeaders();
  const res = await axios.post(
    `${API_BASE_URL}/shows/${tmdbId}/download`,
    { season, episode },
    { headers }
  );
  return res.data;
};

export const trackSeason = async (tmdbId, season, tracked) => {
  const headers = await getAuthHeaders();
  const res = await axios.put(
    `${API_BASE_URL}/shows/${tmdbId}/track`,
    { season, tracked },
    { headers }
  );
  return res.data;
};

export const triggerEpisodeCheck = async () => {
  const headers = await getAuthHeaders();
  const res = await axios.post(`${API_BASE_URL}/shows/check-all`, {}, { headers });
  return res.data;
};

