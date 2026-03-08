'use strict';
/**
 * db.js — SQLite adapter via better-sqlite3.
 *
 * Exposes the exact same interface as PrismaClient so that auth.js,
 * leaderboard.js, replays.js and BattleManager.js need zero changes:
 *   prisma.user.findUnique / create / count
 *   prisma.battle.create / findUnique
 *   prisma.battleParticipant.findMany
 *   prisma.elo.findMany / upsert / update
 *
 * DB file stored at $DB_DIR/pokeserver.db (default ../data/pokeserver.db)
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// ── DB location ──────────────────────────────────────────────────────────────
const dbDir = process.env.DB_DIR ?? path.join(__dirname, '..', 'data');
fs.mkdirSync(dbDir, { recursive: true });
const dbPath = path.join(dbDir, 'pokeserver.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ───────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS User (
    id        TEXT PRIMARY KEY,
    username  TEXT UNIQUE NOT NULL,
    password  TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS Battle (
    id        TEXT PRIMARY KEY,
    format    TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    endedAt   TEXT,
    winnerId  TEXT,
    replayLog TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS BattleParticipant (
    id       TEXT PRIMARY KEY,
    battleId TEXT NOT NULL REFERENCES Battle(id),
    userId   TEXT NOT NULL REFERENCES User(id),
    side     INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS Elo (
    id      TEXT PRIMARY KEY,
    userId  TEXT NOT NULL REFERENCES User(id),
    format  TEXT NOT NULL,
    rating  INTEGER NOT NULL DEFAULT 1000,
    wins    INTEGER NOT NULL DEFAULT 0,
    losses  INTEGER NOT NULL DEFAULT 0,
    UNIQUE(userId, format)
  );
`);

// ── prisma.user ───────────────────────────────────────────────────────────────
const user = {
  count() {
    return db.prepare('SELECT COUNT(*) AS n FROM User').get().n;
  },

  findUnique({ where }) {
    if (where.id !== undefined) {
      return db.prepare('SELECT * FROM User WHERE id = ?').get(where.id) ?? null;
    }
    if (where.username !== undefined) {
      return db.prepare('SELECT * FROM User WHERE username = ?').get(where.username) ?? null;
    }
    return null;
  },

  create({ data }) {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    db.prepare(
      'INSERT INTO User (id, username, password, createdAt) VALUES (?, ?, ?, ?)'
    ).run(id, data.username, data.password, createdAt);
    return { id, username: data.username, password: data.password, createdAt };
  },
};

// ── prisma.battle ─────────────────────────────────────────────────────────────
const battle = {
  /** Used by BattleManager._onBattleEnd — nested participants.create supported */
  create({ data }) {
    const createdAt = new Date().toISOString();
    const endedAt = data.endedAt ? data.endedAt.toISOString() : null;

    db.prepare(`
      INSERT INTO Battle (id, format, createdAt, endedAt, winnerId, replayLog)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(data.id, data.format, createdAt, endedAt, data.winnerId ?? null, data.replayLog ?? '');

    // Nested participants create
    if (data.participants?.create) {
      const ins = db.prepare(
        'INSERT INTO BattleParticipant (id, battleId, userId, side) VALUES (?, ?, ?, ?)'
      );
      for (const p of data.participants.create) {
        ins.run(crypto.randomUUID(), data.id, p.userId, p.side);
      }
    }

    return { id: data.id, format: data.format, createdAt, endedAt, winnerId: data.winnerId ?? null };
  },

  /** Used by replays GET /:id */
  findUnique({ where, include }) {
    const b = db.prepare('SELECT * FROM Battle WHERE id = ?').get(where.id);
    if (!b) return null;

    if (include?.participants) {
      b.participants = _loadParticipants(b.id);
    }
    return b;
  },
};

// ── prisma.battleParticipant ──────────────────────────────────────────────────
const battleParticipant = {
  /** Used by replays GET / — nested battle+participants include */
  findMany({ where, include, orderBy, take }) {
    let sql = `
      SELECT
        bp.id, bp.battleId, bp.userId, bp.side,
        b.id AS b_id, b.format, b.createdAt, b.endedAt, b.winnerId
      FROM BattleParticipant bp
      JOIN Battle b ON b.id = bp.battleId
      WHERE bp.userId = ?
      ORDER BY b.createdAt DESC
    `;
    if (take) sql += ` LIMIT ${Number(take)}`;

    const rows = db.prepare(sql).all(where.userId);

    return rows.map((row) => {
      const b = {
        id: row.b_id,
        format: row.format,
        createdAt: row.createdAt,
        endedAt: row.endedAt,
        winnerId: row.winnerId,
      };

      if (include?.battle?.include?.participants) {
        b.participants = _loadParticipants(row.b_id);
      }

      return {
        id: row.id,
        battleId: row.battleId,
        userId: row.userId,
        side: row.side,
        battle: b,
      };
    });
  },
};

// ── prisma.elo ────────────────────────────────────────────────────────────────
const elo = {
  /** Used by leaderboard GET / */
  findMany({ where, include, orderBy }) {
    let sql = 'SELECT e.*, u.username FROM Elo e JOIN User u ON u.id = e.userId';
    const params = [];

    if (where?.format) {
      sql += ' WHERE e.format = ?';
      params.push(where.format);
    }
    if (orderBy?.rating === 'desc') sql += ' ORDER BY e.rating DESC';

    return db.prepare(sql).all(...params).map((row) => ({
      id: row.id,
      userId: row.userId,
      format: row.format,
      rating: row.rating,
      wins: row.wins,
      losses: row.losses,
      user: { username: row.username },
    }));
  },

  /** Used by BattleManager._updateElo — where uses composite key */
  upsert({ where, update, create }) {
    const { userId, format } = where.userId_format;

    const existing = db
      .prepare('SELECT * FROM Elo WHERE userId = ? AND format = ?')
      .get(userId, format);

    if (existing) return existing;

    const id = crypto.randomUUID();
    db.prepare(
      'INSERT INTO Elo (id, userId, format, rating, wins, losses) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, userId, format, create.rating ?? 1000, create.wins ?? 0, create.losses ?? 0);

    return { id, userId, format, rating: create.rating ?? 1000, wins: create.wins ?? 0, losses: create.losses ?? 0 };
  },

  /** Used by BattleManager._updateElo — supports { increment } shorthand */
  update({ where, data }) {
    const existing = db.prepare('SELECT * FROM Elo WHERE id = ?').get(where.id);
    if (!existing) throw new Error(`Elo record not found: ${where.id}`);

    const rating = data.rating  !== undefined ? data.rating  : existing.rating;
    const wins   = data.wins?.increment   ? existing.wins   + data.wins.increment   : existing.wins;
    const losses = data.losses?.increment ? existing.losses + data.losses.increment : existing.losses;

    db.prepare('UPDATE Elo SET rating = ?, wins = ?, losses = ? WHERE id = ?')
      .run(rating, wins, losses, where.id);

    return { ...existing, rating, wins, losses };
  },
};

// ── Shared helpers ────────────────────────────────────────────────────────────
function _loadParticipants(battleId) {
  return db.prepare(`
    SELECT bp.id, bp.battleId, bp.userId, bp.side, u.username
    FROM BattleParticipant bp
    JOIN User u ON u.id = bp.userId
    WHERE bp.battleId = ?
  `).all(battleId).map((p) => ({
    id: p.id,
    battleId: p.battleId,
    userId: p.userId,
    side: p.side,
    user: { username: p.username },
  }));
}

// ── Export prisma-compatible object ──────────────────────────────────────────
module.exports = { user, battle, battleParticipant, elo };
