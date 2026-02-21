/**
 * BattleManager — manages all active battles, pending challenges, and coordinates
 * between sockets and BattleRoom instances.
 */
const { v4: uuidv4 } = require('uuid');
const BattleRoom = require('./BattleRoom');
const { isValidFormat, isRandomFormat } = require('./formats');
const { calculateElo } = require('../elo');
const prisma = require('../db');

class BattleManager {
  constructor() {
    // Active battles: battleId -> BattleRoom
    this.battles = new Map();

    // Pending challenges: battleId -> { challenger, target, format, createdAt }
    this.challenges = new Map();

    // Track which battle each user is in: userId -> battleId
    this.userBattles = new Map();
  }

  /**
   * Create a challenge from one user to another.
   * @param {object} challenger - { id, username }
   * @param {string} targetId
   * @param {string} format
   * @param {string} [team] - Showdown paste for non-random formats
   * @returns {{ battleId: string }} The challenge/battle ID
   */
  createChallenge(challenger, targetId, format, team) {
    if (!isValidFormat(format)) {
      throw new Error(`Invalid format: ${format}`);
    }

    // Check if challenger is already in a battle
    if (this.userBattles.has(challenger.id)) {
      throw new Error('You are already in a battle');
    }

    // Non-random formats require a team
    if (!isRandomFormat(format) && !team) {
      throw new Error('You must select a team for this format');
    }

    const battleId = uuidv4();
    this.challenges.set(battleId, {
      challenger, // { id, username }
      targetId,
      format,
      challengerTeam: team || null,
      createdAt: Date.now(),
    });

    // Auto-expire challenges after 60 seconds
    setTimeout(() => {
      if (this.challenges.has(battleId)) {
        this.challenges.delete(battleId);
      }
    }, 60000);

    return { battleId };
  }

  /**
   * Accept a challenge and start the battle.
   * @param {string} battleId
   * @param {object} accepter - { id, username }
   * @param {string} [team] - Showdown paste for non-random formats
   * @returns {BattleRoom} The battle room instance
   */
  acceptChallenge(battleId, accepter, team) {
    const challenge = this.challenges.get(battleId);
    if (!challenge) {
      throw new Error('Challenge not found or expired');
    }

    if (challenge.targetId !== accepter.id) {
      throw new Error('This challenge is not for you');
    }

    // Check if accepter is already in a battle
    if (this.userBattles.has(accepter.id)) {
      throw new Error('You are already in a battle');
    }

    // Non-random formats require a team
    if (!isRandomFormat(challenge.format) && !team) {
      throw new Error('You must select a team for this format');
    }

    // Remove the challenge
    this.challenges.delete(battleId);

    // Create the battle room
    const room = new BattleRoom(
      battleId,
      challenge.format,
      challenge.challenger,
      { id: accepter.id, username: accepter.username }
    );

    this.battles.set(battleId, room);
    this.userBattles.set(challenge.challenger.id, battleId);
    this.userBattles.set(accepter.id, battleId);

    // When battle ends, clean up and update Elo
    room.on('end', async (result) => {
      await this._onBattleEnd(room, result);
    });

    // Initialize the battle (starts sim streams)
    room.init();

    // For non-random formats, submit both teams (this triggers _startBattle once both are in)
    if (!isRandomFormat(challenge.format)) {
      room.submitTeam('p1', challenge.challengerTeam);
      room.submitTeam('p2', team);
    }

    return room;
  }

  /**
   * Decline a challenge.
   */
  declineChallenge(battleId, userId) {
    const challenge = this.challenges.get(battleId);
    if (!challenge) {
      throw new Error('Challenge not found or expired');
    }

    if (challenge.targetId !== userId) {
      throw new Error('This challenge is not for you');
    }

    this.challenges.delete(battleId);
  }

  /**
   * Get a battle room by ID.
   */
  getBattle(battleId) {
    return this.battles.get(battleId);
  }

  /**
   * Get a user's current battle.
   */
  getUserBattle(userId) {
    const battleId = this.userBattles.get(userId);
    if (!battleId) return null;
    return this.battles.get(battleId);
  }

  /**
   * Get which side a user is on in a battle.
   */
  getUserSide(battleId, userId) {
    const room = this.battles.get(battleId);
    if (!room) return null;
    if (room.p1.id === userId) return 'p1';
    if (room.p2.id === userId) return 'p2';
    return null;
  }

  /**
   * Get pending challenges for a user.
   */
  getChallengesForUser(userId) {
    const result = [];
    for (const [battleId, challenge] of this.challenges) {
      if (challenge.targetId === userId) {
        result.push({
          battleId,
          challenger: challenge.challenger.username,
          challengerId: challenge.challenger.id,
          format: challenge.format,
          createdAt: challenge.createdAt,
        });
      }
    }
    return result;
  }

  /**
   * Handle battle end — save to DB, update Elo, clean up.
   */
  async _onBattleEnd(room, result) {
    const { battleId, winnerId, loserId, log } = result;

    try {
      // Save battle to DB
      await prisma.battle.create({
        data: {
          id: battleId,
          format: room.format,
          endedAt: new Date(),
          winnerId,
          replayLog: log,
          participants: {
            create: [
              { userId: room.p1.id, side: 0 },
              { userId: room.p2.id, side: 1 },
            ],
          },
        },
      });

      // Update Elo if there's a winner (not a tie)
      if (winnerId && loserId) {
        await this._updateElo(winnerId, loserId, room.format);
      }

      console.log(
        `[Battle ${battleId}] ended — winner: ${result.winnerName || 'tie'}, ` +
        `format: ${room.format}, log: ${log.length} bytes`
      );
    } catch (err) {
      console.error(`[Battle ${battleId}] Failed to save results:`, err.message);
    }

    // Clean up
    this.userBattles.delete(room.p1.id);
    this.userBattles.delete(room.p2.id);
    this.battles.delete(battleId);
    room.destroy();
  }

  /**
   * Update Elo ratings for winner and loser.
   */
  async _updateElo(winnerId, loserId, format) {
    // Get or create Elo records
    const [winnerElo, loserElo] = await Promise.all([
      prisma.elo.upsert({
        where: { userId_format: { userId: winnerId, format } },
        update: {},
        create: { userId: winnerId, format, rating: 1000, wins: 0, losses: 0 },
      }),
      prisma.elo.upsert({
        where: { userId_format: { userId: loserId, format } },
        update: {},
        create: { userId: loserId, format, rating: 1000, wins: 0, losses: 0 },
      }),
    ]);

    // Calculate new ratings
    const { newWinnerRating, newLoserRating } = calculateElo(
      winnerElo.rating,
      loserElo.rating
    );

    // Update both in parallel
    await Promise.all([
      prisma.elo.update({
        where: { id: winnerElo.id },
        data: {
          rating: newWinnerRating,
          wins: { increment: 1 },
        },
      }),
      prisma.elo.update({
        where: { id: loserElo.id },
        data: {
          rating: newLoserRating,
          losses: { increment: 1 },
        },
      }),
    ]);

    return {
      winner: { oldRating: winnerElo.rating, newRating: newWinnerRating },
      loser: { oldRating: loserElo.rating, newRating: newLoserRating },
    };
  }
}

module.exports = BattleManager;
