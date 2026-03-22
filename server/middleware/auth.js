const { admin } = require('../firebase');

const PERMITTED_USERS = (process.env.PERMITTED_USERS || '')
  .split(',')
  .map(u => u.trim().toLowerCase())
  .filter(Boolean);

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    const emailPrefix = (decoded.email || '').split('@')[0].toLowerCase();

    if (!PERMITTED_USERS.includes(emailPrefix)) {
      return res.status(403).json({ error: 'User not permitted' });
    }

    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name || emailPrefix,
      picture: decoded.picture || null,
    };
    next();
  } catch (err) {
    console.error('Auth verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { requireAuth };
