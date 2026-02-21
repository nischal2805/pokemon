/**
 * Test: Is it a timing/scheduling issue?
 * Run the exact BattleRoom pattern 10 times and see how many succeed.
 */
const { BattleStreams, Teams } = require('@pkmn/sim');
const { TeamGenerators } = require('@pkmn/randoms');
const EventEmitter = require('events');
Teams.setGeneratorFactory(TeamGenerators);

async function runOnce(id) {
  const stream = new BattleStreams.BattleStream();
  const streams = BattleStreams.getPlayerStreams(stream);
  const emitter = new EventEmitter();
  let fullLog = '';
  let done = false;
  let winner = null;
  let lastTurn = 0;

  // Player stream readers — emit events
  for (const side of ['p1', 'p2']) {
    (async () => {
      for await (const chunk of streams[side]) {
        const lines = chunk.split('\n');
        let request = null;
        for (const line of lines) {
          if (line.startsWith('|request|')) {
            const json = line.slice('|request|'.length);
            if (json) request = JSON.parse(json);
          }
          if (line.startsWith('|turn|')) {
            lastTurn = parseInt(line.split('|')[2]);
          }
        }
        if (request) {
          emitter.emit('request', { side, request });
        }
      }
    })();
  }

  // Omniscient reader
  (async () => {
    for await (const chunk of streams.omniscient) {
      fullLog += chunk + '\n';
      if (chunk.includes('|win|')) {
        winner = chunk.match(/\|win\|(.+)/)?.[1];
        done = true;
      }
      if (chunk === '|tie' || chunk.includes('|tie|')) {
        done = true;
      }
    }
  })();

  // Choice handler — synchronous within emit
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
    streams[side].write(choice);
  });

  streams.omniscient.write(`>start {"formatid":"gen9randombattle"}`);
  streams.omniscient.write(`>player p1 {"name":"Alice"}`);
  streams.omniscient.write(`>player p2 {"name":"Bob"}`);

  const start = Date.now();
  while (!done && Date.now() - start < 10000) {
    await new Promise(r => setTimeout(r, 50));
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  if (done) {
    return { id, ok: true, winner, elapsed, lastTurn };
  } else {
    return { id, ok: false, elapsed, lastTurn };
  }
}

async function main() {
  let pass = 0, fail = 0;
  for (let i = 1; i <= 10; i++) {
    const r = await runOnce(i);
    if (r.ok) {
      pass++;
      console.log(`  #${r.id}: ✅ ${r.winner || 'tie'} (${r.elapsed}s, ${r.lastTurn} turns)`);
    } else {
      fail++;
      console.log(`  #${r.id}: ❌ HUNG at turn ${r.lastTurn} (${r.elapsed}s)`);
    }
  }
  console.log(`\nResults: ${pass}/10 passed, ${fail}/10 hung`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
