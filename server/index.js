const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth');
const leaderboardRoutes = require('./routes/leaderboard');
const replayRoutes = require('./routes/replays');
const { setupLobby } = require('./lobby');
const { authMiddleware } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  },
  // Faster disconnect detection: detect closed tabs within ~10s instead of ~45s
  pingInterval: 10000,
  pingTimeout: 5000,
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/leaderboard', authMiddleware, leaderboardRoutes);
app.use('/api/replays', authMiddleware, replayRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Socket.io — authenticate on connection
const { authenticateSocket } = require('./middleware/auth');
io.use(authenticateSocket);

// Setup lobby and battle sockets
setupLobby(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🎮 PokeServer running on port ${PORT}`);
});
