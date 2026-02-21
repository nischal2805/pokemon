/**
 * Pinpoint test: Does removing the omniscient listener fix BattleRoom?
 */
const { BattleStreams, Teams } = require('@pkmn/sim');
const { TeamGenerators } = require('@pkmn/randoms');
const EventEmitter = require('events');
Teams.setGeneratorFactory(TeamGenerators);

// Reproduce BattleRoom's exact pattern but with toggleable omniscient reader
async function testWithOmniscient(readOmniscient) {
  const label = readOmniscient ? 'WITH omniscient reader' : 'WITHOUT omniscient reader';
  console.log(`\n=== Test: ${label} ===`);

  const stream = new BattleStreams.BattleStream();
  const streams = BattleStreams.getPlayerStreams(stream);
  const emitter = new EventEmitter();
  let fullLog = '';
  let done = false;
  let winner = null;

  // Player stream readers (same pattern as BattleRoom._listenToPlayerStream)
  for (const side of ['p1', 'p2']) {
    (async () => {
      for await (const chunk of streams[side]) {
        const lines = chunk.split('\n');
        let request = null;
        const updateLines = [];
        for (const line of lines) {
          if (line.startsWith('|request|')) {
            const json = line.slice('|request|'.length);
            if (json) request = JSON.parse(json);
          } else {
            updateLines.push(line);
          }
        }
        if (updateLines.length > 0) {
          emitter.emit('update', { side, log: updateLines.join('\n') });
        }
        if (request) {
          emitter.emit('request', { side, request });
        }
      }
    })();
  }

  // Omniscient reader (same pattern as BattleRoom._listenToOmniscient)
  if (readOmniscient) {
    (async () => {
      for await (const chunk of streams.omniscient) {
        fullLog += chunk + '\n';
        if (chunk.includes('|win|')) {
          winner = chunk.match(/\|win\|(.+)/)?.[1];
          done = true;
        }
        if (chunk.includes('|tie')) {
          done = true;
        }
      }
    })();
  }

  // AI handler via events (same pattern as test-randbat.js)
  emitter.on('request', ({ side, request }) => {
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
      choice = moves.length > 0
        ? `move ${Math.floor(Math.random() * moves.length) + 1}`
        : 'move 1';
    } else {
      choice = 'default';
    }
    try {
      streams[side].write(choice);
    } catch (e) {
      console.log(`  ⚠️ ${side} error: ${e.message}`);
    }
  });

  // Detect win from player streams if not reading omniscient
  if (!readOmniscient) {
    emitter.on('update', ({ side, log }) => {
      fullLog += log + '\n';
      if (log.includes('|win|')) {
        winner = log.match(/\|win\|(.+)/)?.[1];
        done = true;
      }
    });
  }

  // Start
  streams.omniscient.write(`>start {"formatid":"gen9randombattle"}`);
  streams.omniscient.write(`>player p1 {"name":"Alice"}`);
  streams.omniscient.write(`>player p2 {"name":"Bob"}`);

  const start = Date.now();
  while (!done && Date.now() - start < 15000) {
    await new Promise(r => setTimeout(r, 50));
  }

  if (!done) {
    console.log(`  ❌ HUNG after ${((Date.now() - start) / 1000).toFixed(1)}s`);
    const lines = fullLog.split('\n').filter(l => l.startsWith('|turn|'));
    console.log(`  Got to: ${lines[lines.length - 1] || 'no turns'}`);
    return false;
  }
  console.log(`  ✅ Winner: ${winner || 'tie'} | Log: ${fullLog.length} bytes`);
  return true;
}

async function main() {
  const r1 = await testWithOmniscient(false);
  const r2 = await testWithOmniscient(true);
  
  if (r1 && !r2) {
    console.log('\n🔍 CONFIRMED: The omniscient reader causes the hang!');
  } else if (r1 && r2) {
    console.log('\n✅ Both work — issue is elsewhere.');
  } else if (!r1 && !r2) {
    console.log('\n❌ Both hang — issue is in the event-emit pattern.');
  } else {
    console.log('\n🤔 Unexpected result.');
  }
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
