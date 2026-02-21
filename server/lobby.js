/**
 * Lobby — Socket.io namespace that handles:
 * - Online user list
 * - Challenge system (send, accept, decline)
 * - Battle socket events (move, switch, forfeit)
 * - Battle lifecycle (start → updates → end)
 */
const BattleManager = require('./battle/BattleManager');

const battleManager = new BattleManager();

// Track online users: socketId -> { id, username }
const onlineUsers = new Map();
// Track userId -> socketId for targeting specific users
const userSockets = new Map();

function setupLobby(io) {
  io.on('connection', (socket) => {
    const user = socket.user; // Set by authenticateSocket middleware
    console.log(`🟢 ${user.username} connected (${socket.id})`);

    // Register user as online
    onlineUsers.set(socket.id, user);
    userSockets.set(user.id, socket.id);

    // Broadcast updated online list to everyone
    broadcastOnlineList(io);

    // === CHALLENGE EVENTS ===

    socket.on('challenge', ({ targetUser, format }) => {
      try {
        const targetSocketId = userSockets.get(targetUser);
        if (!targetSocketId) {
          return socket.emit('error', { message: 'User is not online' });
        }

        if (targetUser === user.id) {
          return socket.emit('error', { message: 'You cannot challenge yourself' });
        }

        const { battleId } = battleManager.createChallenge(user, targetUser, format);

        // Notify the target
        io.to(targetSocketId).emit('challenged', {
          battleId,
          challenger: user.username,
          challengerId: user.id,
          format,
        });

        // Confirm to challenger
        socket.emit('challengeSent', { battleId, format, target: targetUser });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('accept', ({ battleId }) => {
      try {
        const room = battleManager.acceptChallenge(battleId, user);

        // Both players join the socket room
        const p1SocketId = userSockets.get(room.p1.id);
        const p2SocketId = userSockets.get(room.p2.id);

        if (p1SocketId) io.sockets.sockets.get(p1SocketId)?.join(battleId);
        if (p2SocketId) io.sockets.sockets.get(p2SocketId)?.join(battleId);

        // Wire up battle events to sockets
        _wireBattleEvents(io, room);

        // Notify both players
        io.to(battleId).emit('battleStart', {
          battleId,
          format: room.format,
          p1: { id: room.p1.id, username: room.p1.username },
          p2: { id: room.p2.id, username: room.p2.username },
        });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('decline', ({ battleId }) => {
      try {
        battleManager.declineChallenge(battleId, user.id);

        // Notify the challenger
        const challenge = battleManager.challenges.get(battleId);
        if (challenge) {
          const challengerSocketId = userSockets.get(challenge.challenger.id);
          if (challengerSocketId) {
            io.to(challengerSocketId).emit('challengeDeclined', {
              battleId,
              by: user.username,
            });
          }
        }
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // === BATTLE EVENTS ===

    socket.on('move', ({ battleId, moveChoice }) => {
      try {
        const room = battleManager.getBattle(battleId);
        if (!room) return socket.emit('error', { message: 'Battle not found' });

        const side = battleManager.getUserSide(battleId, user.id);
        if (!side) return socket.emit('error', { message: 'You are not in this battle' });

        room.choose(side, moveChoice);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('switch', ({ battleId, switchChoice }) => {
      try {
        const room = battleManager.getBattle(battleId);
        if (!room) return socket.emit('error', { message: 'Battle not found' });

        const side = battleManager.getUserSide(battleId, user.id);
        if (!side) return socket.emit('error', { message: 'You are not in this battle' });

        room.choose(side, switchChoice);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('team', ({ battleId, team }) => {
      try {
        const room = battleManager.getBattle(battleId);
        if (!room) return socket.emit('error', { message: 'Battle not found' });

        const side = battleManager.getUserSide(battleId, user.id);
        if (!side) return socket.emit('error', { message: 'You are not in this battle' });

        room.submitTeam(side, team);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('forfeit', ({ battleId }) => {
      try {
        const room = battleManager.getBattle(battleId);
        if (!room) return socket.emit('error', { message: 'Battle not found' });

        const side = battleManager.getUserSide(battleId, user.id);
        if (!side) return socket.emit('error', { message: 'You are not in this battle' });

        room.forfeit(side);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // === DISCONNECT ===

    socket.on('disconnect', () => {
      console.log(`🔴 ${user.username} disconnected`);
      onlineUsers.delete(socket.id);
      userSockets.delete(user.id);
      broadcastOnlineList(io);

      // If user was in a battle, forfeit it
      const currentBattle = battleManager.getUserBattle(user.id);
      if (currentBattle && !currentBattle.ended) {
        const side = battleManager.getUserSide(currentBattle.battleId, user.id);
        if (side) {
          currentBattle.forfeit(side);
        }
      }
    });
  });
}

/**
 * Wire BattleRoom events to Socket.io emissions.
 */
function _wireBattleEvents(io, room) {
  // Per-player updates — send to the specific player only
  room.on('update', ({ side, log }) => {
    const userId = side === 'p1' ? room.p1.id : room.p2.id;
    const socketId = userSockets.get(userId);
    if (socketId) {
      io.to(socketId).emit('battleUpdate', {
        battleId: room.battleId,
        log,
      });
    }
  });

  // Request — player needs to make a choice (send only to that player)
  room.on('request', ({ side, request }) => {
    const userId = side === 'p1' ? room.p1.id : room.p2.id;
    const socketId = userSockets.get(userId);
    if (socketId) {
      io.to(socketId).emit('battleRequest', {
        battleId: room.battleId,
        request,
      });
    }
  });

  // Choice error — player sent an invalid move, sim will resend request
  room.on('choiceError', ({ side, message }) => {
    const userId = side === 'p1' ? room.p1.id : room.p2.id;
    const socketId = userSockets.get(userId);
    if (socketId) {
      io.to(socketId).emit('battleChoiceError', {
        battleId: room.battleId,
        message,
      });
    }
  });

  // Battle end — broadcast to both players
  room.on('end', (result) => {
    io.to(room.battleId).emit('battleEnd', {
      battleId: room.battleId,
      winner: result.winnerName,
      winnerId: result.winnerId,
    });

    // Remove players from socket room
    const p1SocketId = userSockets.get(room.p1.id);
    const p2SocketId = userSockets.get(room.p2.id);
    if (p1SocketId) io.sockets.sockets.get(p1SocketId)?.leave(room.battleId);
    if (p2SocketId) io.sockets.sockets.get(p2SocketId)?.leave(room.battleId);
  });
}

/**
 * Send the online user list to all connected clients.
 */
function broadcastOnlineList(io) {
  const users = Array.from(onlineUsers.values()).map((u) => ({
    id: u.id,
    username: u.username,
  }));
  io.emit('onlineList', users);
}

module.exports = { setupLobby };
