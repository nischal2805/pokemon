/**
 * Parse battle-animations-moves.ts to extract move → shape/category mappings.
 * Maps Showdown's showEffect sprite names and attacker.anim patterns to our CSS shapes.
 * 
 * Run: node reference/parse-move-anims.js
 * Output: prints JS object literals ready to paste into moveEffects.ts
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'battle-animations-moves.ts'), 'utf8');

// Showdown effect sprite → our EffectShape mapping
const SPRITE_TO_SHAPE = {
  // Orb-like projectiles
  fireball: 'orb', shadowball: 'orb', energyball: 'orb', electroball: 'orb',
  iceball: 'orb', pokeball: 'orb', poisonwisp: 'orb', mistball: 'orb',
  bluefireball: 'orb', toxicorb: 'orb', flameorb: 'orb', mudball: 'orb',
  rockchip: 'orb', seed: 'orb', leaf: 'orb',
  // Beam-like effects
  lightning: 'beam', thunder: 'beam', electroball: 'beam',
  ray: 'beam', hyperbeam: 'beam', solarbeam: 'beam',
  // Slash/impact effects
  rightslash: 'slash', leftslash: 'slash', rightchop: 'slash', leftchop: 'slash',
  claw: 'slash', bite: 'slash', sword: 'slash',
  // Burst/explosion effects
  explosion: 'burst', fist: 'burst', foot: 'burst', rock: 'burst',
  impact: 'burst', punch: 'burst',
  // Wave/spread effects
  waterwisp: 'wave', waterpulse: 'wave', wave: 'wave', surf: 'wave',
  icecluster: 'wave', icicle: 'wave', rocks: 'wave', earthquake: 'wave',
  mudwisp: 'wave', sandstorm: 'wave',
  // Aura/status effects
  wisp: 'aura', poisonwisp: 'aura', confuse: 'aura', heart: 'aura',
  anger: 'aura', angry: 'aura', swirl: 'aura', spindle: 'aura',
  pointer: 'aura', flower: 'aura', petal: 'aura', feather: 'aura',
  music: 'aura', note: 'aura', web: 'aura', net: 'aura',
  alpha: 'aura', omega: 'aura', rainbow: 'aura', zsymbol: 'aura',
};

// Sprite → type hint mapping (best guesses from sprite names)
const SPRITE_TO_TYPE = {
  fireball: 'Fire', bluefireball: 'Fire', flameorb: 'Fire',
  shadowball: 'Ghost', wisp: 'Ghost',
  energyball: 'Grass', leaf: 'Grass', seed: 'Grass', petal: 'Grass',
  electroball: 'Electric', lightning: 'Electric', thunder: 'Electric',
  iceball: 'Ice', icecluster: 'Ice', icicle: 'Ice',
  waterwisp: 'Water', waterpulse: 'Water', surf: 'Water', mudball: 'Water',
  poisonwisp: 'Poison', toxicorb: 'Poison',
  rock: 'Rock', rockchip: 'Rock', rocks: 'Rock',
  fist: 'Fighting', foot: 'Fighting',
  mudwisp: 'Ground', earthquake: 'Ground', sandstorm: 'Ground',
  claw: 'Normal', bite: 'Dark',
  feather: 'Flying',
  heart: 'Fairy', flower: 'Fairy',
  confuse: 'Psychic', mistball: 'Psychic',
  web: 'Bug', net: 'Bug',
};

// Extract all move entries: find lines like "\tmovename: {"
const moveRegex = /^\t([a-z][a-z0-9]*): \{/gm;
const moves = {};
let match;

while ((match = moveRegex.exec(src)) !== null) {
  const moveName = match[1];
  const startIdx = match.index;
  
  // Find the end of this move's block (next move entry or end)
  const nextMatch = /^\t[a-z][a-z0-9]*: \{/m.exec(src.slice(startIdx + 1));
  const endIdx = nextMatch ? startIdx + 1 + nextMatch.index : src.length;
  const block = src.slice(startIdx, endIdx);
  
  // Count which showEffect sprites are used
  const effectCounts = {};
  const effectRegex = /scene\.showEffect\('([^']+)'/g;
  let em;
  while ((em = effectRegex.exec(block)) !== null) {
    const sprite = em[1];
    effectCounts[sprite] = (effectCounts[sprite] || 0) + 1;
  }
  
  // Check for attacker lunge (physical contact indicator)
  const hasAttackerLunge = /attacker\.anim\(\{[^}]*x:\s*defender\.x/s.test(block);
  const hasAttackerShake = /attacker\.anim\(\{[^}]*y:\s*attacker\.y\s*[-+]/s.test(block);
  const hasBgShake = /scene\.\$bg\.animate/s.test(block);
  
  // Determine shape from dominant sprite
  let shape = null;
  let type = null;
  let bestCount = 0;
  
  for (const [sprite, count] of Object.entries(effectCounts)) {
    if (count > bestCount && SPRITE_TO_SHAPE[sprite]) {
      bestCount = count;
      shape = SPRITE_TO_SHAPE[sprite];
      if (SPRITE_TO_TYPE[sprite]) type = SPRITE_TO_TYPE[sprite];
    }
  }
  
  // Override: if attacker lunges to defender position, it's physical → slash/burst
  if (hasAttackerLunge && !shape) {
    shape = 'slash';
  }
  if (hasBgShake) {
    shape = 'wave'; // screen shake = earthquake-style
  }
  
  // Determine category
  let category = 'Special';
  if (hasAttackerLunge) category = 'Physical';
  
  // Check for status patterns (no showEffect projectiles, mostly aura/self effects)
  const totalEffects = Object.values(effectCounts).reduce((a, b) => a + b, 0);
  const isStatusLike = totalEffects === 0 || 
    (shape === 'aura' && !hasAttackerLunge && !Object.keys(effectCounts).some(s => 
      ['fireball','shadowball','energyball','electroball','iceball','lightning','thunder'].includes(s)
    ));
  if (isStatusLike && !hasAttackerLunge && !hasBgShake) {
    category = 'Status';
    if (!shape) shape = 'aura';
  }
  
  if (!shape) shape = 'orb'; // fallback
  
  moves[moveName] = { shape, category, type, sprites: Object.keys(effectCounts) };
}

console.log(`Parsed ${Object.keys(moves).length} moves from reference file.\n`);

// Now generate the data we need for moveEffects.ts
// We want: MOVE_TYPES additions, PHYSICAL_MOVES additions, STATUS_MOVES additions, and per-move shape overrides

// Existing moves in moveEffects.ts (don't duplicate)
const EXISTING_TYPES = new Set([
  'flamethrower','fireblast','overheat','lavaplume','eruption','heatwave','flareblitz','blazekick',
  'sacredfire','firepunch','pyroball','mysticalfire','willowisp','bitterblade','magmastorm','burnup',
  'surf','scald','hydropump','waterfall','aquajet','liquidation','muddywater','originpulse',
  'flipturn','wavecrash','jetpunch','surgingstrikes',
  'thunderbolt','thunder','voltswitch','wildcharge','discharge','boltstrike',
  'risingvoltage','thunderwave','nuzzle','electroball','supercellslam','thunderclap',
  'leafstorm','gigadrain','energyball','woodhammer','leafblade','seedbomb','powerwhip','grassknot',
  'sleeppowder','spore','synthesis','hornleech',
  'icebeam','blizzard','iceshard','icepunch','freezedry','iciclecrash','glaciallance','tripledive',
  'auroraveil','iciclespear',
  'psychic','psyshock','futuresight','expandingforce','photongeyser','psystrike',
  'calmmind','trickroom','trick','teleport',
  'closecombat','aurasphere','focusblast','drainpunch','machpunch','superpower',
  'bodypress','sacredsword','bulletpunch',
  'sludgebomb','sludgewave','gunkshot','poisonjab','toxicspikes','toxic','venoshock',
  'earthquake','earthpower','stompingtantrum','precipiceblades','scorchingsands','highhorsepower',
  'spikes','stealthrock','stoneedge',
  'hurricane','bravebird','airslash','acrobatics','aeroblast','defog',
  'bugbuzz','uturn','megahorn','firstimpression','leechlife','pounce','xscissor',
  'rockslide','powergem','headsmash','rockblast',
  'shadowball','shadowclaw','hex','phantomforce','poltergeist','shadowsneak','spectralthief',
  'lastrespects','bittermalice',
  'dracometeor','dragonpulse','outrage','dragonclaw','dragontail','scaleshot',
  'dragonenergy','clangingscales',
  'knockoff','darkpulse','suckerpunch','crunch','pursuit','foulplay','wickedblow','nightslash',
  'kowtowcleave','ruination',
  'ironhead','flashcannon','meteormash','heavyslam','gyroball','makeitrain',
  'moonblast','dazzlinggleam','playrough','drainingkiss','spiritbreak','moonlight',
  'fleurcannon','naturesmadness',
  'bodyslam','facade','extremespeed','return','hyperbeam','gigaimpact','rapidspin','explosion',
  'boomburst','doubleedge','fakeout','quickattack','headbutt','populationbomb','bloodmoon',
  'recover','roost','softboiled','swordsdance','nastyplot','shellsmash','dragondance',
  'substitute','protect','wish','healbell','taunt','encore','stickyweb',
]);

// Build new entries
const newTypes = {};
const newPhysical = [];
const newStatus = [];
const shapeOverrides = {};

for (const [move, data] of Object.entries(moves)) {
  if (EXISTING_TYPES.has(move)) continue;
  
  if (data.type) {
    newTypes[move] = data.type;
  }
  
  if (data.category === 'Physical') newPhysical.push(move);
  if (data.category === 'Status') newStatus.push(move);
}

// Print MOVE_TYPES additions grouped by type
console.log('// ═══ NEW MOVE_TYPES entries (add to existing MOVE_TYPES) ═══');
const byType = {};
for (const [move, type] of Object.entries(newTypes)) {
  if (!byType[type]) byType[type] = [];
  byType[type].push(move);
}
for (const [type, moveList] of Object.entries(byType).sort()) {
  const entries = moveList.sort().map(m => `${m}: '${type}'`).join(', ');
  console.log(`  // ${type} (${moveList.length} new)`);
  // Print in rows of 4
  for (let i = 0; i < moveList.length; i += 4) {
    const chunk = moveList.slice(i, i + 4).map(m => `${m}: '${type}'`).join(', ');
    console.log(`  ${chunk},`);
  }
}

console.log(`\n// ═══ NEW PHYSICAL_MOVES entries (${newPhysical.length} new) ═══`);
for (let i = 0; i < newPhysical.length; i += 6) {
  const chunk = newPhysical.slice(i, i + 6).map(m => `'${m}'`).join(', ');
  console.log(`  ${chunk},`);
}

console.log(`\n// ═══ NEW STATUS_MOVES entries (${newStatus.length} new) ═══`);
for (let i = 0; i < newStatus.length; i += 6) {
  const chunk = newStatus.slice(i, i + 6).map(m => `'${m}'`).join(', ');
  console.log(`  ${chunk},`);
}

// Also output per-move shape overrides (moves that don't match the generic type→shape mapping)
console.log(`\n// ═══ MOVE_SHAPE_OVERRIDES — per-move shape when generic type mapping isn't right ═══`);
console.log('// (e.g. Earthquake is Ground/Physical but should be "wave" not "slash")');
const overrides = {};
for (const [move, data] of Object.entries(moves)) {
  // Only output if the shape differs from what getMoveVisual would return
  overrides[move] = data.shape;
}

// Group overrides by shape
const byShape = {};
for (const [move, shape] of Object.entries(overrides)) {
  if (!byShape[shape]) byShape[shape] = [];
  byShape[shape].push(move);
}
for (const [shape, moveList] of Object.entries(byShape).sort()) {
  console.log(`  // ${shape} (${moveList.length} moves)`);
}

console.log(`\nTotal: ${Object.keys(moves).length} moves parsed`);
console.log(`New type mappings: ${Object.keys(newTypes).length}`);
console.log(`New physical: ${newPhysical.length}`);
console.log(`New status: ${newStatus.length}`);
