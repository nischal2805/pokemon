/**
 * Debug: Dump everything the omniscient stream sends for a randbat.
 */
const { BattleStreams, Teams } = require('@pkmn/sim');
const { TeamGenerators } = require('@pkmn/randoms');

Teams.setGeneratorFactory(TeamGenerators);

async function debug() {
  const stream = new BattleStreams.BattleStream();
  const streams = BattleStreams.getPlayerStreams(stream);

  let chunkNum = 0;
  
  // Listen to omniscient
  (async () => {
    for await (const chunk of streams.omniscient) {
      chunkNum++;
      console.log(`\n=== OMNISCIENT CHUNK #${chunkNum} ===`);
      console.log(chunk);
      console.log(`=== END CHUNK #${chunkNum} ===`);
    }
    console.log('\n=== OMNISCIENT STREAM ENDED ===');
  })();

  // Listen to p1
  let p1ChunkNum = 0;
  (async () => {
    for await (const chunk of streams.p1) {
      p1ChunkNum++;
      console.log(`\n--- P1 CHUNK #${p1ChunkNum} ---`);
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('|request|')) {
          const req = JSON.parse(line.slice('|request|'.length));
          console.log('  REQUEST:', JSON.stringify(req).slice(0, 200));
        } else {
          console.log(' ', line);
        }
      }
    }
  })();

  streams.omniscient.write(`>start {"formatid":"gen9randombattle"}`);
  streams.omniscient.write(`>player p1 {"name":"Alice"}`);
  streams.omniscient.write(`>player p2 {"name":"Bob"}`);

  // Wait a bit to see initial output
  await new Promise((r) => setTimeout(r, 2000));

  console.log('\n--- Making choices: p1: move 1, p2: move 1 ---');
  streams.p1.write('move 1');
  streams.p2.write('move 1');

  await new Promise((r) => setTimeout(r, 2000));

  process.exit(0);
}

debug().catch((e) => { console.error(e); process.exit(1); });
