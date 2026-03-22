const axios = require('axios');

const VIDEO_EXTENSIONS = ['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm'];

function getConfig() {
  return {
    url: process.env.QBITTORRENT_URL || 'http://localhost:8080',
    user: process.env.QBITTORRENT_USER || 'admin',
    pass: process.env.QBITTORRENT_PASS || 'adminadmin',
  };
}

async function login() {
  const { url, user, pass } = getConfig();
  const res = await axios.post(
    `${url}/api/v2/auth/login`,
    `username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return res.headers['set-cookie']?.[0] || '';
}

async function ensureCategory(cookie, category) {
  const { url } = getConfig();
  try {
    await axios.post(
      `${url}/api/v2/torrents/createCategory`,
      `category=${encodeURIComponent(category)}`,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookie } }
    );
  } catch (e) {
    if (e.response?.status !== 409) throw e;
  }
}

async function addTorrent(cookie, magnetLink, category) {
  const { url } = getConfig();
  let body = `urls=${encodeURIComponent(magnetLink)}`;
  if (category) {
    await ensureCategory(cookie, category);
    body += `&category=${encodeURIComponent(category)}`;
  }
  await axios.post(
    `${url}/api/v2/torrents/add`,
    body,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookie } }
  );
}

async function getFiles(cookie, hash) {
  const { url } = getConfig();
  const res = await axios.get(
    `${url}/api/v2/torrents/files?hash=${hash.toLowerCase()}`,
    { headers: { 'Cookie': cookie } }
  );
  return res.data;
}

async function getTorrents(cookie) {
  const { url } = getConfig();
  const res = await axios.get(
    `${url}/api/v2/torrents/info`,
    { headers: { 'Cookie': cookie } }
  );
  return res.data;
}

async function deleteTorrent(cookie, hash, deleteFiles = true) {
  const { url } = getConfig();
  await axios.post(
    `${url}/api/v2/torrents/delete`,
    `hashes=${hash}&deleteFiles=${deleteFiles}`,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookie } }
  );
}

async function waitForFiles(cookie, hash, maxAttempts = 15, intervalMs = 2000) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const files = await getFiles(cookie, hash);
      if (files && files.length > 0 && files[0].name !== '') return files;
    } catch (e) { /* metadata not ready */ }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  return null;
}

function findVideoFile(files) {
  return files
    .filter(f => VIDEO_EXTENSIONS.some(ext => f.name.toLowerCase().endsWith(ext)))
    .sort((a, b) => b.size - a.size)[0];
}

function parseEpisodeFromName(name) {
  const match = name.match(/S(\d{1,2})E(\d{1,2})/i);
  if (match) {
    return { season: parseInt(match[1], 10), episode: parseInt(match[2], 10) };
  }
  return null;
}

module.exports = {
  getConfig,
  login,
  ensureCategory,
  addTorrent,
  getFiles,
  getTorrents,
  deleteTorrent,
  waitForFiles,
  findVideoFile,
  parseEpisodeFromName,
  VIDEO_EXTENSIONS,
};
