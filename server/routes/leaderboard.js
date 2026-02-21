const express = require('express');
const prisma = require('../db');

const router = express.Router();

// GET /api/leaderboard?format=gen9randombattle
router.get('/', async (req, res) => {
  try {
    const { format } = req.query;
    if (!format) {
      return res.status(400).json({ error: 'Format parameter required' });
    }

    const entries = await prisma.elo.findMany({
      where: { format },
      include: { user: { select: { username: true } } },
      orderBy: { rating: 'desc' },
    });

    const leaderboard = entries.map((e, i) => ({
      rank: i + 1,
      username: e.user.username,
      rating: e.rating,
      wins: e.wins,
      losses: e.losses,
      games: e.wins + e.losses,
      winRate: e.wins + e.losses > 0
        ? Math.round((e.wins / (e.wins + e.losses)) * 100)
        : 0,
    }));

    res.json(leaderboard);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
