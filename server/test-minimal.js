/**
 * Minimal test: Use @pkmn/sim's own RandomPlayerAI with our BattleRoom
 * to confirm the stream wiring works. If this hangs, the issue is in BattleRoom.
 * If this works, the issue is in the test AI logic.
 */
const { BattleStreams, RandomPlayerAI, Teams } = require('@pkmn/sim');
const { TeamGenerators } = require('@pkmn/randoms');

Teams.setGeneratorFactory(TeamGenerators);

// ── Test 1: Raw streams with RandomPlayerAI (known working) ──
async function testRaw() {
  console.log('=== Test 1: Raw streams + RandomPlayerAI ===');
  const stream = new BattleStreams.BattleStream();
  const streams = BattleStreams.getPlayerStreams(stream);

  let log = '';
  const logDone = (async () => {
    for await (const chunk of streams.omniscient) {
      log += chunk + '\n';
    }
  })();

  const p1ai = new RandomPlayerAI(streams.p1);
  const p2ai = new RandomPlayerAI(streams.p2);
  void p1ai.start();
  void p2ai.start();

  streams.omniscient.write(`>start {"formatid":"gen9randombattle"}`);
  streams.omniscient.write(`>player p1 {"name":"Alice"}`);
  streams.omniscient.write(`>player p2 {"name":"Bob"}`);

  await logDone;
  
  const winner = log.match(/\|win\|(.+)/)?.[1] || 'TIE';
  console.log(`  Winner: ${winner}`);
  console.log(`  Log: ${log.length} bytes`);
  console.log('  ✅ PASSED\n');
}

// ── Test 2: Manual choices on player streams (what BattleRoom does) ──
async function testManual() {
  console.log('=== Test 2: Manual stream writes (BattleRoom style) ===');
  const stream = new BattleStreams.BattleStream();
  const streams = BattleStreams.getPlayerStreams(stream);

  let log = '';
  let done = false;

  // Omniscient log collector
  (async () => {
    for await (const chunk of streams.omniscient) {
      log += chunk + '\n';
      if (chunk.includes('|win|') || chunk.includes('|tie')) {
        done = true;
      }
    }
  })();

  // Player stream handlers — read requests, respond with random moves
  function handlePlayer(side) {
    (async () => {
      for await (const chunk of streams[side]) {
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.startsWith('|request|')) continue;
          const json = line.slice('|request|'.length);
          if (!json) continue;
          
          const req = JSON.parse(json);
          if (req.wait) continue;
          
          let choice;
          if (req.forceSwitch) {
            const pokemon = req.side.pokemon;
            const alive = pokemon.filter((p, i) => i > 0 && p.condition !== '0 fnt' && !p.active);
            if (alive.length > 0) {
              const pick = alive[Math.floor(Math.random() * alive.length)];
              choice = `switch ${pokemon.indexOf(pick) + 1}`;
            } else {
              choice = 'pass';
            }
          } else if (req.active) {
            const moves = req.active[0].moves.filter(m => !m.disabled);
            if (moves.length > 0) {
              choice = `move ${Math.floor(Math.random() * moves.length) + 1}`;
            } else {
              choice = 'move 1';
            }
          } else if (req.teamPreview) {
            choice = 'default';
          } else {
            choice = 'default';
          }

          // Write choice directly to player stream
          streams[side].write(choice);
        }
      }
    })();
  }

  handlePlayer('p1');
  handlePlayer('p2');

  // Start battle
  streams.omniscient.write(`>start {"formatid":"gen9randombattle"}`);
  streams.omniscient.write(`>player p1 {"name":"Alice"}`);
  streams.omniscient.write(`>player p2 {"name":"Bob"}`);

  // Wait for completion
  const start = Date.now();
  while (!done && Date.now() - start < 30000) {
    await new Promise(r => setTimeout(r, 100));
  }

  if (!done) {
    console.log('  ❌ TIMED OUT — battle hung');
    console.log(`  Log so far (${log.length} bytes):`);
    const lines = log.split('\n');
    // Show last 20 lines
    console.log(lines.slice(-20).join('\n'));
    return false;
  }

  const winner = log.match(/\|win\|(.+)/)?.[1] || 'TIE';
  console.log(`  Winner: ${winner}`);
  console.log(`  Log: ${log.length} bytes`);
  console.log('  ✅ PASSED\n');
  return true;
}

// ── Test 3: BattleRoom class with external choices ──
async function testBattleRoom() {
  console.log('=== Test 3: BattleRoom class ===');
  const BattleRoom = require('./battle/BattleRoom');

  const room = new BattleRoom('test-br', 'gen9randombattle',
    { id: 'u1', username: 'Alice' },
    { id: 'u2', username: 'Bob' }
  );

  let done = false;
  let winner = null;

  room.on('request', ({ side, request }) => {
    if (request.wait) return;

    let choice;
    if (request.forceSwitch) {
      const pokemon = request.side.pokemon;
      const alive = pokemon.filter((p, i) => i > 0 && p.condition !== '0 fnt' && !p.active);
      if (alive.length > 0) {
        const pick = alive[Math.floor(Math.random() * alive.length)];
        choice = `switch ${pokemon.indexOf(pick) + 1}`;
      } else {
        choice = 'pass';
      }
    } else if (request.active) {
      const moves = request.active[0].moves.filter(m => !m.disabled);
      if (moves.length > 0) {
        choice = `move ${Math.floor(Math.random() * moves.length) + 1}`;
      } else {
        choice = 'move 1';
      }
    } else if (request.teamPreview) {
      choice = 'default';
    } else {
      choice = 'default';
    }

    // Use room.choose which writes to streams[side]
    try {
      room.choose(side, choice);
    } catch (err) {
      console.log(`  ⚠️ ${side} choice "${choice}" failed: ${err.message}`);
    }
  });

  room.on('end', (result) => {
    done = true;
    winner = result.winnerName;
  });

  room.init();

  // Wait for completion
  const start = Date.now();
  while (!done && Date.now() - start < 30000) {
    await new Promise(r => setTimeout(r, 100));
  }

  if (!done) {
    console.log('  ❌ TIMED OUT — BattleRoom hung');
    console.log(`  Log so far (${room.fullLog.length} bytes):`);
    const lines = room.fullLog.split('\n');
    console.log(lines.slice(-30).join('\n'));
    return false;
  }

  console.log(`  Winner: ${winner || 'TIE'}`);
  console.log(`  Log: ${room.fullLog.length} bytes`);
  console.log('  ✅ PASSED\n');
  room.destroy();
  return true;
}

async function main() {
  await testRaw();
  const t2 = await testManual();
  if (!t2) {
    console.log('Test 2 failed — stream writing issue. Skipping Test 3.');
    process.exit(1);
  }
  const t3 = await testBattleRoom();
  if (!t3) {
    console.log('Test 3 failed — BattleRoom issue.');
    process.exit(1);
  }
  console.log('🎉 All tests passed!');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
