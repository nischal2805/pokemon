/**
 * Generate complete move type/category/shape data from @pkmn/sim + reference file.
 * Uses authoritative data from the sim for type/category, and the reference file
 * for shape overrides based on visual analysis of showEffect sprites.
 *
 * Run: node reference/gen-move-data.js > reference/move-data-output.txt
 */
const fs = require('fs');
const path = require('path');
// Resolve @pkmn/sim from the server directory where it's installed
const { Dex } = require(path.join(__dirname, '..', 'server', 'node_modules', '@pkmn', 'sim'));

// ── Step 1: Get authoritative type/category from @pkmn/sim ──
const allMoves = {};
for (const move of Dex.moves.all()) {
  if (!move.exists || move.num <= 0) continue;
  allMoves[move.id] = { type: move.type, category: move.category };
}

// ── Step 2: Parse reference file for shape hints ──
const src = fs.readFileSync(path.join(__dirname, 'battle-animations-moves.ts'), 'utf8');

const SPRITE_TO_SHAPE = {
  fireball: 'orb', shadowball: 'orb', energyball: 'orb', electroball: 'orb',
  iceball: 'orb', mistball: 'orb', bluefireball: 'orb', mudball: 'orb',
  seed: 'orb', pokeball: 'orb', toxicorb: 'orb', flameorb: 'orb',
  lightning: 'beam', thunder: 'beam', ray: 'beam', hyperbeam: 'beam', solarbeam: 'beam',
  rightslash: 'slash', leftslash: 'slash', rightchop: 'slash', leftchop: 'slash',
  claw: 'slash', sword: 'slash',
  explosion: 'burst', fist: 'burst', foot: 'burst', rock: 'burst',
  waterwisp: 'wave', waterpulse: 'wave', surf: 'wave',
  icecluster: 'wave', icicle: 'wave', rocks: 'wave',
  mudwisp: 'wave',
  wisp: 'aura', poisonwisp: 'aura', heart: 'aura', angry: 'aura',
  pointer: 'aura', flower: 'aura', petal: 'aura', feather: 'aura',
  music: 'aura', note: 'aura', web: 'aura', confuse: 'aura',
  leaf: 'orb', rockchip: 'orb',
};

const moveRegex = /^\t([a-z][a-z0-9]*): \{/gm;
const moveShapes = {};
let match;

while ((match = moveRegex.exec(src)) !== null) {
  const moveName = match[1];
  const startIdx = match.index;
  const nextMatch = /^\t[a-z][a-z0-9]*: \{/m.exec(src.slice(startIdx + 1));
  const endIdx = nextMatch ? startIdx + 1 + nextMatch.index : src.length;
  const block = src.slice(startIdx, endIdx);

  const effectCounts = {};
  const effectRegex = /scene\.showEffect\('([^']+)'/g;
  let em;
  while ((em = effectRegex.exec(block)) !== null) {
    const sprite = em[1];
    if (SPRITE_TO_SHAPE[sprite]) {
      const shape = SPRITE_TO_SHAPE[sprite];
      effectCounts[shape] = (effectCounts[shape] || 0) + 1;
    }
  }

  const hasLunge = /attacker\.anim\(\{[^}]*x:\s*defender\.x/s.test(block);
  const hasBgShake = /scene\.\$bg\.animate/s.test(block);

  // Pick dominant shape
  let shape = null;
  let best = 0;
  for (const [s, c] of Object.entries(effectCounts)) {
    if (c > best) { best = c; shape = s; }
  }

  if (hasBgShake) shape = 'wave';
  if (!shape && hasLunge) shape = 'slash';
  if (!shape) shape = null; // no override, use generic

  if (shape) moveShapes[moveName] = shape;
}

// ── Step 3: Generate moveEffects.ts data ──

// Build complete MOVE_TYPES, PHYSICAL_MOVES, STATUS_MOVES, and MOVE_SHAPES
const moveTypes = {};
const physicalMoves = [];
const statusMoves = [];
const moveShapeOverrides = {};

for (const [id, data] of Object.entries(allMoves)) {
  moveTypes[id] = data.type;
  if (data.category === 'Physical') physicalMoves.push(id);
  if (data.category === 'Status') statusMoves.push(id);

  // Shape override from reference file
  if (moveShapes[id]) {
    moveShapeOverrides[id] = moveShapes[id];
  }
}

// ── Step 4: Output formatted TS-ready data ──

// Group types for readability
const byType = {};
for (const [id, type] of Object.entries(moveTypes)) {
  if (!byType[type]) byType[type] = [];
  byType[type].push(id);
}

let output = '';

output += '/** Complete move type map — auto-generated from @pkmn/sim */\n';
output += 'const MOVE_TYPES: Record<string, string> = {\n';
for (const type of Object.keys(byType).sort()) {
  const moves = byType[type].sort();
  output += `  // ${type} (${moves.length})\n`;
  for (let i = 0; i < moves.length; i += 5) {
    const chunk = moves.slice(i, i + 5).map(m => `${m}: '${type}'`).join(', ');
    output += `  ${chunk},\n`;
  }
}
output += '};\n\n';

output += `/** Physical moves (${physicalMoves.length}) — auto-generated from @pkmn/sim */\n`;
output += 'const PHYSICAL_MOVES = new Set([\n';
const sortedPhys = physicalMoves.sort();
for (let i = 0; i < sortedPhys.length; i += 6) {
  const chunk = sortedPhys.slice(i, i + 6).map(m => `'${m}'`).join(', ');
  output += `  ${chunk},\n`;
}
output += ']);\n\n';

output += `/** Status moves (${statusMoves.length}) — auto-generated from @pkmn/sim */\n`;
output += 'const STATUS_MOVES = new Set([\n';
const sortedStatus = statusMoves.sort();
for (let i = 0; i < sortedStatus.length; i += 6) {
  const chunk = sortedStatus.slice(i, i + 6).map(m => `'${m}'`).join(', ');
  output += `  ${chunk},\n`;
}
output += ']);\n\n';

output += `/** Per-move shape overrides from Showdown animation analysis (${Object.keys(moveShapeOverrides).length} moves) */\n`;
output += 'const MOVE_SHAPE_OVERRIDES: Record<string, EffectShape> = {\n';
const byShapeGroup = {};
for (const [id, shape] of Object.entries(moveShapeOverrides)) {
  if (!byShapeGroup[shape]) byShapeGroup[shape] = [];
  byShapeGroup[shape].push(id);
}
for (const shape of Object.keys(byShapeGroup).sort()) {
  const moves = byShapeGroup[shape].sort();
  output += `  // ${shape} (${moves.length})\n`;
  for (let i = 0; i < moves.length; i += 6) {
    const chunk = moves.slice(i, i + 6).map(m => `${m}: '${shape}'`).join(', ');
    output += `  ${chunk},\n`;
  }
}
output += '};\n';

console.log(`Generated data for ${Object.keys(moveTypes).length} moves`);
console.log(`  Types: ${Object.keys(byType).length} types`);
console.log(`  Physical: ${physicalMoves.length}`);
console.log(`  Status: ${statusMoves.length}`);
console.log(`  Special: ${Object.keys(moveTypes).length - physicalMoves.length - statusMoves.length}`);
console.log(`  Shape overrides: ${Object.keys(moveShapeOverrides).length}`);

fs.writeFileSync(path.join(__dirname, 'move-data-output.ts'), output);
console.log('\nWrote to reference/move-data-output.ts');
