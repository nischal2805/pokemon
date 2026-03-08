/**
 * BattleRoom — manages a single battle instance using @pkmn/sim.
 *
 * Uses BattlePlayer subclasses for each side to handle stream I/O
 * correctly. This avoids the deadlock caused by multiple competing
 * `for await` readers on @pkmn/streams objects.
 *
 * BattlePlayer's proven pattern: one `for await` per player stream,
 * with choices written synchronously inside the receive callback.
 *
 * The sim is authoritative. Clients are dumb displays.
 */
const { BattleStreams, Teams, Dex } = require('@pkmn/sim');
const { TeamGenerators } = require('@pkmn/randoms');
const EventEmitter = require('events');
const { isRandomFormat } = require('./formats');

// Register random team generators (safe to call multiple times)
Teams.setGeneratorFactory(TeamGenerators);

/**
 * PlayerAgent — extends BattlePlayer to bridge sim I/O with our event system.
 *
 * BattlePlayer.start() does:
 *   for await (chunk of stream) → receive(chunk) → receiveLine(line)
 *
 * We override receiveLine to parse requests/updates and emit them,
 * and expose makeChoice() for external callers.
 */
class PlayerAgent extends BattleStreams.BattlePlayer {
  constructor(playerStream, side, emitter) {
    super(playerStream, false);
    this.side = side;       // 'p1' or 'p2'
    this.emitter = emitter; // The BattleRoom EventEmitter
    this._updateBuffer = [];
  }

  // Called by BattlePlayer base class for each line in a chunk
  receiveLine(line) {
    if (line.startsWith('|request|')) {
      // Flush accumulated update lines before the request
      this._flushUpdates();
      const json = line.slice('|request|'.length);
      if (json) {
        try {
          const request = JSON.parse(json);
          this.emitter.emit('request', {
            battleId: this.emitter.battleId,
            side: this.side,
            request,
          });
        } catch (e) {
          console.error(`[${this.side}] Failed to parse request:`, e.message);
        }
      }
    } else if (line.startsWith('|error|')) {
      const msg = line.slice('|error|'.length);
      if (msg.startsWith('[Unavailable choice]') || msg.startsWith('[Invalid choice]')) {
        // The sim will auto-resend the request after this error.
        // Emit the error so clients know their choice was rejected.
        this.emitter.emit('choiceError', {
          battleId: this.emitter.battleId,
          side: this.side,
          message: msg,
        });
      } else {
        this.emitter.emit('playerError', { side: this.side, message: msg });
      }
    } else if (line.length > 0) {
      this._updateBuffer.push(line);
    }
  }

  // BattlePlayer calls receive(chunk) which calls receiveLine per line.
  // We override receive so we can flush after the whole chunk is processed.
  receive(chunk) {
    super.receive(chunk);
    this._flushUpdates();
  }

  _flushUpdates() {
    if (this._updateBuffer.length > 0) {
      this.emitter.emit('update', {
        battleId: this.emitter.battleId,
        side: this.side,
        log: this._updateBuffer.join('\n'),
      });
      this._updateBuffer = [];
    }
  }

  // Ignore unavailable/invalid choice errors — sim will resend a request
  receiveError(error) {
    if (error.message.startsWith('[Unavailable choice]')) return;
    if (error.message.startsWith('[Invalid choice]')) return;
    console.error(`[${this.side}] Stream error:`, error.message);
  }

  // Public method for external callers to submit a choice
  makeChoice(choice) {
    this.choose(choice);
  }
}


class BattleRoom extends EventEmitter {
  /**
   * @param {string} battleId - Unique battle ID
   * @param {string} format  - Format string (e.g. 'gen9randombattle')
   * @param {object} p1      - { id, username }
   * @param {object} p2      - { id, username }
   */
  constructor(battleId, format, p1, p2) {
    super();
    this.battleId = battleId;
    this.format = format;
    this.p1 = p1;
    this.p2 = p2;
    this.isRandom = isRandomFormat(format);
    this.started = false;
    this.ended = false;
    this.winner = null;
    this.winnerId = null;
    this.fullLog = '';
    this._createdAt = Date.now();

    this.stream = null;
    this.streams = null;
    this.p1Agent = null;
    this.p2Agent = null;

    this.teamsReady = { p1: false, p2: false };
  }

  /**
   * Initialize the battle stream and start listening for output.
   */
  init() {
    this.stream = new BattleStreams.BattleStream();
    this.streams = BattleStreams.getPlayerStreams(this.stream);

    // Create player agents using BattlePlayer's proven for-await pattern
    this.p1Agent = new PlayerAgent(this.streams.p1, 'p1', this);
    this.p2Agent = new PlayerAgent(this.streams.p2, 'p2', this);

    // Start the agents (begins their for-await read loops)
    void this.p1Agent.start();
    void this.p2Agent.start();

    // Listen to the omniscient stream for replay log + win detection
    this._listenToOmniscient();

    if (this.isRandom) {
      this._startBattle();
    }
  }

  /**
   * Submit a team for a non-random format.
   */
  submitTeam(side, teamString) {
    if (this.isRandom) throw new Error('Cannot submit teams for random formats');
    if (this.started) throw new Error('Battle already started');

    const team = Teams.import(teamString);
    if (!team || team.length === 0) throw new Error('Invalid team format');

    this[`${side}Team`] = Teams.pack(team);
    this.teamsReady[side] = true;

    if (this.teamsReady.p1 && this.teamsReady.p2) {
      this._startBattle();
    }
  }

  /**
   * Make a choice for a player.
   * Delegates to the PlayerAgent which writes synchronously to the stream.
   */
  choose(side, choice) {
    if (!this.started) throw new Error('Battle has not started');
    if (this.ended) throw new Error('Battle has ended');

    const agent = side === 'p1' ? this.p1Agent : this.p2Agent;
    agent.makeChoice(choice);
  }

  /**
   * Forfeit the battle.
   */
  forfeit(side) {
    if (this.ended) return;
    const winner = side === 'p1' ? 'p2' : 'p1';
    this.streams.omniscient.write(`>forcewin ${winner}`);
  }

  /**
   * Start the actual battle in the sim.
   */
  _startBattle() {
    this.started = true;

    this.streams.omniscient.write(`>start ${JSON.stringify({ formatid: this.format })}`);

    if (this.isRandom) {
      this.streams.omniscient.write(`>player p1 ${JSON.stringify({ name: this.p1.username })}`);
      this.streams.omniscient.write(`>player p2 ${JSON.stringify({ name: this.p2.username })}`);
    } else {
      this.streams.omniscient.write(
        `>player p1 ${JSON.stringify({ name: this.p1.username, team: this.p1Team })}`
      );
      this.streams.omniscient.write(
        `>player p2 ${JSON.stringify({ name: this.p2.username, team: this.p2Team })}`
      );
    }

    this.emit('started', { battleId: this.battleId });
  }

  /**
   * Listen to the omniscient stream for replay log + win/tie detection.
   */
  _listenToOmniscient() {
    (async () => {
      try {
        for await (const chunk of this.streams.omniscient) {
          this.fullLog += chunk + '\n';
          this._checkForEnd(chunk);
        }
      } catch (err) {
        console.error(`[${this.battleId}] omniscient stream error:`, err.message);
      }

      // Stream ended — if battle never produced |win| or |tie|, force cleanup
      if (!this.ended) {
        console.warn(`[${this.battleId}] omniscient stream ended without |win| or |tie|, forcing cleanup`);
        this.ended = true;
        this.emit('end', {
          battleId: this.battleId,
          winner: null,
          winnerId: null,
          winnerName: null,
          loserId: null,
          log: this.fullLog,
        });
      }
    })();
  }

  /**
   * Check omniscient output for |win| or |tie| to end the battle.
   */
  _checkForEnd(chunk) {
    for (const line of chunk.split('\n')) {
      if (this.ended) break; // Prevent double-emit if chunk has multiple |win|/|tie| lines

      if (line.startsWith('|win|')) {
        const winnerName = line.slice('|win|'.length);
        this.ended = true;

        if (winnerName === this.p1.username) {
          this.winner = 'p1';
          this.winnerId = this.p1.id;
        } else if (winnerName === this.p2.username) {
          this.winner = 'p2';
          this.winnerId = this.p2.id;
        }

        this.emit('end', {
          battleId: this.battleId,
          winner: this.winner,
          winnerId: this.winnerId,
          winnerName,
          loserId: this.winner === 'p1' ? this.p2.id : this.p1.id,
          log: this.fullLog,
        });
      } else if (line === '|tie' || line.startsWith('|tie|')) {
        this.ended = true;
        this.winner = null;
        this.winnerId = null;

        this.emit('end', {
          battleId: this.battleId,
          winner: null,
          winnerId: null,
          winnerName: null,
          loserId: null,
          log: this.fullLog,
        });
      }
    }
  }

  /**
   * Clean up streams and agents.
   */
  destroy() {
    if (this.streams) {
      try { this.streams.omniscient.end(); } catch (e) { /* already ended */ }
    }
    this.removeAllListeners();
  }
}

module.exports = BattleRoom;
