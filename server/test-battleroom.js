/**
 * Test: Run a full random battle using BattleRoom directly.
 * No database, no sockets — just the engine.
 * 
 * This simulates two players making random choices each turn
 * to validate the full battle flow through our BattleRoom class.
 * 
 * Usage: node test-battleroom.js
 */
const BattleRoom = require('./battle/BattleRoom');

const p1 = { id: 'user-1', username: 'Alice' };
const p2 = { id: 'user-2', username: 'Bob' };

const room = new BattleRoom('test-battle-001', 'gen9randombattle', p1, p2);

let turnCount = 0;

// Listen to updates — log what each player sees
room.on('update', ({ side, log }) => {
  const lines = log.split('\n').filter((l) => l.length > 1);
  const name = side === 'p1' ? 'Alice' : 'Bob';
  
  for (const line of lines) {
    if (line.startsWith('|turn|')) {
      turnCount++;
      console.log(`\n========== Turn ${turnCount} ==========`);
    } else if (line.startsWith('|switch|') || line.startsWith('|drag|')) {
      console.log(`  🔄 [${name}] ${line}`);
    } else if (line.startsWith('|move|')) {
      console.log(`  ⚔️  [${name}] ${line}`);
    } else if (line.startsWith('|faint|')) {
      console.log(`  💀 [${name}] ${line}`);
    } else if (line.startsWith('|-supereffective|')) {
      console.log(`  💪 [${name}] ${line}`);
    } else if (line.startsWith('|-mega|')) {
      console.log(`  🌟 [${name}] MEGA EVOLUTION: ${line}`);
    }
  }
});

// Listen to requests — auto-pick a random valid choice
room.on('request', ({ side, request }) => {
  const name = side === 'p1' ? 'Alice' : 'Bob';

  if (request.wait) {
    // Waiting for the other player
    return;
  }

  let choice;

  if (request.forceSwitch) {
    // Must switch — pick first available pokemon
    const available = request.side.pokemon.filter(
      (p, i) => i > 0 && p.condition !== '0 fnt' && !p.active
    );
    if (available.length > 0) {
      const target = request.side.pokemon.indexOf(available[Math.floor(Math.random() * available.length)]);
      choice = `switch ${target + 1}`;
    } else {
      choice = 'pass';
    }
  } else if (request.active) {
    // Can make a move or switch
    const moves = request.active[0].moves.filter((m) => !m.disabled && m.pp > 0);
    
    // 80% chance to use a move, 20% chance to switch (if possible)
    const shouldSwitch = Math.random() < 0.2;
    const availableSwitches = request.side.pokemon.filter(
      (p, i) => i > 0 && p.condition !== '0 fnt'
    );

    if (shouldSwitch && availableSwitches.length > 0) {
      const target = request.side.pokemon.indexOf(
        availableSwitches[Math.floor(Math.random() * availableSwitches.length)]
      );
      choice = `switch ${target + 1}`;
    } else if (moves.length > 0) {
      const moveIdx = Math.floor(Math.random() * moves.length) + 1;
      choice = `move ${moveIdx}`;
      
      // Check if mega evolution is available
      if (request.active[0].canMegaEvo) {
        choice += ' mega';
        console.log(`  🌟 [${name}] Mega evolving!`);
      }
    } else {
      // No moves with PP — use Struggle
      choice = 'move 1';
    }
  } else if (request.teamPreview) {
    // Team preview — just use default order
    choice = 'default';
  } else {
    choice = 'default';
  }

  console.log(`  🎮 [${name}] chose: ${choice}`);
  
  // Small delay to make output readable
  setTimeout(() => {
    try {
      room.choose(side, choice);
    } catch (err) {
      console.error(`  ❌ [${name}] choice error: ${err.message}`);
    }
  }, 10);
});

// Listen for battle end
room.on('end', (result) => {
  console.log('\n🏆🏆🏆🏆🏆🏆🏆🏆🏆🏆🏆🏆🏆🏆🏆');
  if (result.winnerName) {
    console.log(`  WINNER: ${result.winnerName}!`);
  } else {
    console.log(`  TIE!`);
  }
  console.log(`  Turns: ${turnCount}`);
  console.log(`  Log size: ${result.log.length} bytes`);
  console.log('🏆🏆🏆🏆🏆🏆🏆🏆🏆🏆🏆🏆🏆🏆🏆\n');
  process.exit(0);
});

room.on('started', () => {
  console.log('=== Battle started! Format: gen9randombattle ===');
  console.log(`  ${p1.username} vs ${p2.username}\n`);
});

// Start the battle
console.log('Initializing BattleRoom...');
room.init();

// Safety timeout — if battle doesn't end in 60s, something is wrong
setTimeout(() => {
  console.error('\n❌ Battle timed out after 60 seconds!');
  process.exit(1);
}, 60000);
