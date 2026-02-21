/**
 * Generate static data files for the interactive team builder.
 * Extracts items, abilities, natures, and species data from @pkmn/sim.
 */
const path = require('path');

// Resolve @pkmn/sim from the server's node_modules
const simPath = path.join(__dirname, '..', 'server', 'node_modules', '@pkmn', 'sim');
const { Dex } = require(simPath);

// ── Items ──
const items = [];
for (const item of Dex.items.all()) {
  if (item.exists && item.num > 0 && !item.isNonstandard) {
    items.push(item.name);
  }
}
items.sort();

// ── Abilities ──
const abilities = [];
for (const ability of Dex.abilities.all()) {
  if (ability.exists && ability.num > 0 && !ability.isNonstandard) {
    abilities.push(ability.name);
  }
}
abilities.sort();

// ── Natures ──
const natures = [];
for (const nature of Dex.natures.all()) {
  if (nature.exists) {
    natures.push({
      name: nature.name,
      plus: nature.plus || null,
      minus: nature.minus || null,
    });
  }
}
natures.sort((a, b) => a.name.localeCompare(b.name));

// ── Moves (just names for autocomplete) ──
const moves = [];
for (const move of Dex.moves.all()) {
  if (move.exists && move.num > 0 && !move.isNonstandard && move.name !== 'Struggle') {
    moves.push(move.name);
  }
}
moves.sort();

// ── Species (name + types + base stats for builder display) ──
const species = [];
for (const s of Dex.species.all()) {
  if (s.exists && s.num > 0 && !s.isNonstandard) {
    species.push({
      name: s.name,
      types: s.types,
      baseStats: s.baseStats,
    });
  }
}
species.sort((a, b) => a.name.localeCompare(b.name));

// Write out
const fs = require('fs');

const outDir = path.join(__dirname, '..', 'client', 'src', 'lib');

fs.writeFileSync(path.join(outDir, 'items.json'), JSON.stringify(items));
console.log(`items.json: ${items.length} items`);

fs.writeFileSync(path.join(outDir, 'abilities.json'), JSON.stringify(abilities));
console.log(`abilities.json: ${abilities.length} abilities`);

fs.writeFileSync(path.join(outDir, 'natures.json'), JSON.stringify(natures));
console.log(`natures.json: ${natures.length} natures`);

fs.writeFileSync(path.join(outDir, 'moves.json'), JSON.stringify(moves));
console.log(`moves.json: ${moves.length} moves`);

fs.writeFileSync(path.join(outDir, 'speciesData.json'), JSON.stringify(species));
console.log(`speciesData.json: ${species.length} species`);
