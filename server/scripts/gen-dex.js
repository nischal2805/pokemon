/**
 * One-time script: generates dex.json mapping from @pkmn/img
 * Maps spriteid -> dex number for PokeAPI GitHub sprite URLs
 * 
 * Run: node server/scripts/gen-dex.js
 */
const fs = require('fs');
const path = require('path');
const { Sprites } = require('@pkmn/img');

const dex = {};
const data = Sprites.data;

// @pkmn/img data has a .pokemon property or we iterate via known method
// The data object stores pokemon info keyed by id
// Let's access the internal pokemon data
if (data && typeof data[Symbol.iterator] === 'function') {
  for (const pokemon of data) {
    if (pokemon.num > 0 && pokemon.spriteid) {
      dex[pokemon.spriteid] = pokemon.num;
    }
  }
} else {
  // Fallback: use the Dex from @pkmn/sim to get all species, then map via Sprites.data
  try {
    const { Dex } = require('@pkmn/sim');
    for (const species of Dex.species.all()) {
      if (species.num > 0 && species.exists) {
        const pkData = data.getPokemon(species.name);
        if (pkData && pkData.num > 0) {
          dex[pkData.spriteid] = pkData.num;
          // Also store by lowercase id for easier lookup
          if (pkData.id && pkData.id !== pkData.spriteid) {
            dex[pkData.id] = pkData.num;
          }
        }
      }
    }
  } catch (e) {
    console.error('Could not load @pkmn/sim Dex, trying manual approach...');
    // Manual approach: test a big range of known pokemon
    const { Generations } = require('@pkmn/data');
    const { Dex } = require('@pkmn/dex');
    const gens = new Generations(Dex);
    for (const gen of gens) {
      for (const species of gen.species) {
        if (species.num > 0 && species.exists) {
          const pkData = data.getPokemon(species.name);
          if (pkData && pkData.num > 0) {
            dex[pkData.spriteid] = pkData.num;
            if (pkData.id && pkData.id !== pkData.spriteid) {
              dex[pkData.id] = pkData.num;
            }
          }
        }
      }
    }
  }
}

const count = Object.keys(dex).length;
console.log(`Generated ${count} pokemon sprite mappings`);

if (count === 0) {
  console.error('ERROR: No mappings generated! Trying direct data dump...');
  // Last resort: just dump what we can from data object
  console.log('Data type:', typeof data);
  console.log('Data keys:', Object.keys(data).slice(0, 20));
  process.exit(1);
}

// Write to client
const outPath = path.join(__dirname, '..', '..', 'client', 'src', 'lib', 'dex.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(dex, null, 0));
console.log(`Written to ${outPath}`);

// Show some samples
const samples = ['pikachu', 'snorlax', 'garchomp', 'greattusk', 'ironbundle', 'landorus-therian', 'charizard-mega-x'];
for (const s of samples) {
  console.log(`  ${s} -> ${dex[s] || 'NOT FOUND'}`);
}
