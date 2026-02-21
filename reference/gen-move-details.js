/**
 * Generate move details (accuracy, power, type, category) for the MovePanel display.
 * Uses @pkmn/sim Dex for authoritative data.
 */
const path = require('path');
const fs = require('fs');

const simPath = path.join(__dirname, '..', 'server', 'node_modules', '@pkmn', 'sim');
const { Dex } = require(simPath);

const moveDetails = {};

for (const move of Dex.moves.all()) {
  if (move.exists && move.num > 0 && !move.isNonstandard && move.name !== 'Struggle') {
    // Use the move id (lowercase, no spaces/hyphens) as key — matches what @pkmn/sim sends in requests
    moveDetails[move.id] = {
      accuracy: move.accuracy === true ? 0 : move.accuracy, // true means "never misses" → 0 to signal that
      power: move.basePower,
      type: move.type,
      category: move.category,
    };
  }
}

const outPath = path.join(__dirname, '..', 'client', 'src', 'lib', 'moveDetails.json');
fs.writeFileSync(outPath, JSON.stringify(moveDetails));
console.log(`moveDetails.json: ${Object.keys(moveDetails).length} moves`);
