const jwt = require('jsonwebtoken');
const cookie = require('cookie-parser');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-change-me-in-production';

function authMiddleware(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, username }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Socket.io middleware — reads JWT from handshake auth or cookies
function authenticateSocket(socket, next) {
  try {
    // Try auth token first (sent by client in handshake)
    let token = socket.handshake.auth?.token;

    // Fallback: parse cookie header
    if (!token && socket.handshake.headers.cookie) {
      const cookies = parseCookies(socket.handshake.headers.cookie);
      token = cookies.token;
    }

    if (!token) {
      return next(new Error('Authentication required'));
    }

    const payload = jwt.verify(token, JWT_SECRET);
    socket.user = payload; // { id, username }
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
}

// Simple cookie parser for raw cookie header string
function parseCookies(cookieHeader) {
  const cookies = {};
  cookieHeader.split(';').forEach((cookie) => {
    const [name, ...rest] = cookie.trim().split('=');
    cookies[name] = decodeURIComponent(rest.join('='));
  });
  return cookies;
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

module.exports = { authMiddleware, authenticateSocket, signToken, JWT_SECRET };
