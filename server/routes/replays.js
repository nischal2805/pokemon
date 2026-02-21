const express = require('express');
const prisma = require('../db');

const router = express.Router();

// GET /api/replays — recent battles for the authenticated user
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    const participations = await prisma.battleParticipant.findMany({
      where: { userId },
      include: {
        battle: {
          include: {
            participants: {
              include: { user: { select: { username: true } } },
            },
          },
        },
      },
      orderBy: { battle: { createdAt: 'desc' } },
      take: 10,
    });

    const replays = participations.map((p) => ({
      battleId: p.battle.id,
      format: p.battle.format,
      createdAt: p.battle.createdAt,
      endedAt: p.battle.endedAt,
      winnerId: p.battle.winnerId,
      players: p.battle.participants.map((bp) => ({
        username: bp.user.username,
        side: bp.side,
      })),
    }));

    res.json(replays);
  } catch (err) {
    console.error('Replays error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/replays/:id — full replay log for one battle
router.get('/:id', async (req, res) => {
  try {
    const battle = await prisma.battle.findUnique({
      where: { id: req.params.id },
      include: {
        participants: {
          include: { user: { select: { username: true } } },
        },
      },
    });

    if (!battle) {
      return res.status(404).json({ error: 'Battle not found' });
    }

    res.json({
      id: battle.id,
      format: battle.format,
      createdAt: battle.createdAt,
      endedAt: battle.endedAt,
      winnerId: battle.winnerId,
      replayLog: battle.replayLog,
      players: battle.participants.map((p) => ({
        username: p.user.username,
        side: p.side,
      })),
    });
  } catch (err) {
    console.error('Replay fetch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
