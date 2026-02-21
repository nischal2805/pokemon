/**
 * Battle engine test suite.
 *
 * Test 1 — Smoke test: 1 battle through BattleRoom, verify it completes.
 * Test 2 — Stress test: 50 battles, assert real protocol content + zero choice errors.
 *
 * Uses randomChoice.js for AI (mirrors @pkmn/sim RandomPlayerAI logic).
 * Run: node test.js
 */
const BattleRoom = require('./battle/BattleRoom');
const { makeRandomChoice } = require('./battle/randomChoice');

const STRESS_COUNT = 50;
const TIMEOUT_MS = 15000;

// ── Helpers ──

function runBattle(id) {
  return new Promise((resolve) => {
    const room = new BattleRoom(
      `test-${id}`, 'gen9randombattle',
      { id: `p1-${id}`, username: `Alice${id}` },
      { id: `p2-${id}`, username: `Bob${id}` },
    );

    const stats = {
      requests: { p1: 0, p2: 0 },
      choiceErrors: [],
      turns: 0,
      done: false,
      winner: null,
      winnerName: null,
      logBytes: 0,
    };

    room.on('update', ({ log }) => {
      for (const line of log.split('\n')) {
        if (line.startsWith('|turn|')) {
          const t = parseInt(line.split('|')[2]);
          if (t > stats.turns) stats.turns = t;
        }
      }
    });

    room.on('request', ({ side, request }) => {
      stats.requests[side]++;
      const choice = makeRandomChoice(request);
      if (!choice) return;
      try { room.choose(side, choice); } catch (e) {
        stats.choiceErrors.push(`${side}: ${e.message}`);
      }
    });

    room.on('choiceError', ({ side, message }) => {
      stats.choiceErrors.push(`${side}: ${message}`);
    });

    room.on('end', (result) => {
      stats.done = true;
      stats.winner = result.winner;
      stats.winnerName = result.winnerName;
      stats.logBytes = (result.log || '').length;
    });

    room.init();

    const start = Date.now();
    const poll = setInterval(() => {
      if (stats.done || Date.now() - start > TIMEOUT_MS) {
        clearInterval(poll);
        const elapsed = ((Date.now() - start) / 1000).toFixed(2);
        const log = room.fullLog;
        room.destroy();
        resolve({ id, elapsed, stats, log });
      }
    }, 25);
  });
}

function assertBattle(result) {
  const errors = [];
  const { stats, log } = result;
  if (!stats.done)                     errors.push('TIMEOUT');
  if (!log.includes('|gametype|'))     errors.push('no |gametype|');
  if (!log.includes('|turn|'))         errors.push('no |turn|');
  if (!log.includes('|move|'))         errors.push('no |move|');
  if (!log.includes('|win|') && !log.includes('|tie'))
                                       errors.push('no |win| or |tie|');
  if (stats.turns < 1)                errors.push(`${stats.turns} turns`);
  if (stats.requests.p1 < 2)          errors.push(`p1 ${stats.requests.p1} reqs`);
  if (stats.requests.p2 < 2)          errors.push(`p2 ${stats.requests.p2} reqs`);
  if (stats.choiceErrors.length > 0)   errors.push(`choice errors: ${stats.choiceErrors.join('; ')}`);
  if (stats.logBytes < 500)           errors.push(`log ${stats.logBytes}B`);
  return errors;
}

// ── Test 1: Smoke ──

async function testSmoke() {
  console.log('── Test 1: Smoke (1 battle) ──');
  const r = await runBattle('smoke');
  const errs = assertBattle(r);
  if (errs.length > 0) {
    console.log(`  ❌ FAIL: ${errs.join(', ')}`);
    return false;
  }
  console.log(`  ✅ ${r.stats.winnerName} won in ${r.stats.turns} turns (${r.elapsed}s, ${(r.stats.logBytes/1024).toFixed(1)}KB log)`);
  return true;
}

// ── Test 2: Stress ──

async function testStress() {
  console.log(`\n── Test 2: Stress (${STRESS_COUNT} battles) ──`);
  let pass = 0, fail = 0;

  for (let i = 1; i <= STRESS_COUNT; i++) {
    const r = await runBattle(i);
    const errs = assertBattle(r);
    if (errs.length === 0) {
      pass++;
      process.stdout.write(`  #${String(i).padStart(2)}: ✅ ${(r.stats.winnerName||'TIE').padEnd(10)} ${String(r.stats.turns).padStart(2)} turns  ${r.elapsed}s\n`);
    } else {
      fail++;
      process.stdout.write(`  #${String(i).padStart(2)}: ❌ ${errs[0]}\n`);
    }
  }

  console.log(`\n  Result: ${pass}/${STRESS_COUNT} passed`);
  return fail === 0;
}

// ── Main ──

async function main() {
  console.log('=== PokeServer Battle Engine Tests ===\n');
  const smoke = await testSmoke();
  if (!smoke) { console.log('\nSmoke test failed, aborting.'); process.exit(1); }
  const stress = await testStress();
  if (!stress) { console.log('\n⚠️  Stress test had failures.'); process.exit(1); }
  console.log('\n🎉 All tests passed.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
