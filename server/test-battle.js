/**
 * Quick test: Run a full random battle between two AIs.
 * This validates that @pkmn/sim is working correctly.
 * 
 * Usage: node test-battle.js
 */
const { BattleStreams, RandomPlayerAI, Teams, Dex } = require('@pkmn/sim');
const { TeamGenerators } = require('@pkmn/randoms');

async function testBattle() {
  console.log('=== Starting Random Battle Test ===\n');

  // Register the random team generator factory — required for randbat formats
  Teams.setGeneratorFactory(TeamGenerators);

  const stream = new BattleStreams.BattleStream();
  const streams = BattleStreams.getPlayerStreams(stream);

  // Collect omniscient (full) log
  let fullLog = '';
  const logPromise = (async () => {
    for await (const chunk of streams.omniscient) {
      fullLog += chunk + '\n';
    }
  })();

  // Two random AIs that auto-play
  const p1 = new RandomPlayerAI(streams.p1);
  const p2 = new RandomPlayerAI(streams.p2);
  void p1.start();
  void p2.start();

  // Start the battle — for randbat, no team needed
  streams.omniscient.write(`>start {"formatid":"gen9randombattle"}`);
  streams.omniscient.write(`>player p1 {"name":"Alice"}`);
  streams.omniscient.write(`>player p2 {"name":"Bob"}`);

  // Wait for the AIs to finish the full battle
  await logPromise;

  console.log('=== FULL BATTLE LOG ===\n');
  
  const lines = fullLog.split('\n');
  lines.forEach((line) => {
    // Highlight key events
    if (line.startsWith('|win|')) {
      console.log(`\n🏆 ${line}`);
    } else if (line.startsWith('|move|')) {
      console.log(`  ⚔️  ${line}`);
    } else if (line.startsWith('|switch|')) {
      console.log(`  🔄 ${line}`);
    } else if (line.startsWith('|faint|')) {
      console.log(`  💀 ${line}`);
    } else if (line.startsWith('|-damage|')) {
      console.log(`  💥 ${line}`);
    } else if (line.startsWith('|-status|')) {
      console.log(`  🤒 ${line}`);
    } else if (line.startsWith('|turn|')) {
      console.log(`\n--- ${line} ---`);
    } else if (line.startsWith('|player|')) {
      console.log(`  👤 ${line}`);
    } else if (line.startsWith('|teamsize|')) {
      console.log(`  📋 ${line}`);
    } else if (line.startsWith('|-mega|')) {
      console.log(`  🌟 ${line}`);
    } else if (line.startsWith('|')) {
      // Print other sim messages, skip empty
      if (line.length > 1) {
        console.log(`     ${line}`);
      }
    }
  });

  console.log(`\n=== Battle finished! Total log lines: ${lines.length} ===`);
  console.log('\n=== Raw log length:', fullLog.length, 'bytes ===');
}

testBattle().catch((err) => {
  console.error('Battle test failed:', err);
  process.exit(1);
});
