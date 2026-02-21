/**
 * Supported battle formats.
 * The `id` is passed directly to @pkmn/sim as the format string.
 */

const FORMATS = [
  {
    id: 'gen9randombattle',
    name: 'Random Battle',
    gen: 9,
    isRandom: true,
    isDoubles: false,
    description: 'Random teams, singles',
  },
  {
    id: 'gen9ou',
    name: 'OU',
    gen: 9,
    isRandom: false,
    isDoubles: false,
    description: 'Standard competitive singles',
  },
  {
    id: 'gen9ubers',
    name: 'Ubers',
    gen: 9,
    isRandom: false,
    isDoubles: false,
    description: 'Legendaries allowed',
  },
  {
    id: 'gen9anythinggoes',
    name: 'Anything Goes',
    gen: 9,
    isRandom: false,
    isDoubles: false,
    description: 'Truly unrestricted singles',
  },
  {
    id: 'gen9doublesou',
    name: 'Doubles OU',
    gen: 9,
    isRandom: false,
    isDoubles: true,
    description: 'Standard doubles',
  },
  {
    id: 'gen9doublesubers',
    name: 'Doubles Ubers',
    gen: 9,
    isRandom: false,
    isDoubles: true,
    description: 'Unrestricted doubles',
  },
  {
    id: 'gen9randomdoublesbattle',
    name: 'Random Doubles',
    gen: 9,
    isRandom: true,
    isDoubles: true,
    description: 'Chaotic random doubles',
  },
  {
    id: 'gen7ou',
    name: 'Mega Battle (Gen 7)',
    gen: 7,
    isRandom: false,
    isDoubles: false,
    description: 'Gen 7 OU — full mega evolution support',
  },
  {
    id: 'gen7randombattle',
    name: 'Random Mega (Gen 7)',
    gen: 7,
    isRandom: true,
    isDoubles: false,
    description: 'Random teams with mega access',
  },
];

function getFormat(formatId) {
  return FORMATS.find((f) => f.id === formatId);
}

function isValidFormat(formatId) {
  return FORMATS.some((f) => f.id === formatId);
}

function isRandomFormat(formatId) {
  const fmt = getFormat(formatId);
  return fmt ? fmt.isRandom : false;
}

module.exports = { FORMATS, getFormat, isValidFormat, isRandomFormat };
