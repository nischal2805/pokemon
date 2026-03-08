/**
 * Sprite URL utilities using PokeAPI GitHub as CDN
 * Maps pokemon names -> dex numbers via static dex.json
 * All URLs point to raw.githubusercontent.com (no Cloudflare blocking)
 */
import dex from './dex.json';

const DEX: Record<string, number> = dex as Record<string, number>;

const BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

/**
 * Normalise a species name to match dex.json keys.
 * Battle protocol sends things like "Landorus-Therian", "Great Tusk", "Mr. Mime"
 * dex.json has keys like "landorus-therian", "greattusk", "mrmime"
 */
function toKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, ''); // strip spaces, dots, apostrophes etc
}

/**
 * Look up the national dex number for a species name.
 * Tries the hyphenated form first (spriteid), then the squished id.
 * Also tries stripping forme suffixes so e.g. Garchomp-Mega shows Garchomp sprite.
 */
function getDexNum(name: string): number | null {
  if (!name) return null;
  const raw = name.toLowerCase().trim();

  // Try exact as-is (handles "landorus-therian" style)
  if (DEX[raw]) return DEX[raw];

  // Try stripped key (handles "Great Tusk" -> "greattusk")
  const key = toKey(name);
  if (DEX[key]) return DEX[key];

  // Try with hyphens preserved but otherwise cleaned
  const hyphenKey = raw.replace(/[^a-z0-9-]/g, '');
  if (DEX[hyphenKey]) return DEX[hyphenKey];

  // Try base forme — strip everything after first hyphen
  // e.g. "Urshifu-Rapid-Strike" → "urshifu", "Wormadam-Sandy" → "wormadam"
  const baseKey = raw.split('-')[0];
  if (baseKey && DEX[baseKey]) return DEX[baseKey];

  // Try stripping trailing forme word (handles mega/alola/galar/hisui)
  const noForme = raw.replace(/-(mega|mega-x|mega-y|alola|alolan|galar|galarian|hisui|hisuian|paldea|paldean|crowned|eternamax|origin|sky|therian|black|white|sandy|trash|plant|heat|wash|frost|fan|mow|standard|zen|pirouette|ordinary|resolute|active|core|blade|10|50|complete|dusk|dawn|midnight|midday|original|totem|3|pa|la|ma|a|b|c|d)$/g, '');
  if (DEX[noForme]) return DEX[noForme];

  return null;
}

/**
 * Animated front/back sprite (GIF) with static PNG fallback
 */
export function spriteUrl(name: string, back = false): string {
  if (!name) return '';
  const num = getDexNum(name);
  if (!num) return '';
  const dir = back ? 'back/' : '';
  // Animated GIF from showdown subfolder
  return `${BASE}/other/showdown/${dir}${num}.gif`;
}

/**
 * Static front sprite (PNG) — good for icons/fallback
 */
export function iconUrl(name: string): string {
  if (!name) return '';
  const num = getDexNum(name);
  if (!num) return '';
  return `${BASE}/${num}.png`;
}

/**
 * Static PNG fallback (same as iconUrl, used when GIF is unavailable)
 */
export function staticSpriteUrl(name: string): string {
  return iconUrl(name);
}

/**
 * Item sprite from PokeAPI
 * PokeAPI item sprites use lowercase-hyphenated names
 */
export function itemUrl(item: string): string {
  if (!item) return '';
  // Convert "Choice Scarf" -> "choice-scarf", "leftovers" -> "leftovers"
  const slug = item
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')  // replace non-alphanum runs with hyphens
    .replace(/^-|-$/g, '');         // trim leading/trailing hyphens
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${slug}.png`;
}

/**
 * onerror handler for <img> tags — swap animated GIF for static PNG fallback.
 * Never hides the image entirely — shows a styled placeholder instead.
 */
export function onSpriteError(e: Event): void {
  const img = e.target as HTMLImageElement;
  const src = img.src;
  // If it was a showdown GIF, try the static PNG
  if (src.includes('/other/showdown/')) {
    const match = src.match(/(\d+)\.gif$/);
    if (match) {
      img.src = `${BASE}/${match[1]}.png`;
      img.style.imageRendering = 'pixelated';
      return;
    }
  }
  // If it was a regular PNG that also failed, show a styled fallback
  // (don't hide — a blank void looks like a bug)
  img.style.opacity = '0.15';
  img.style.filter = 'grayscale(1)';
  // Try a generic silhouette: PokeAPI ditto sprite as universal fallback
  if (!src.includes('/132.')) {
    img.src = `${BASE}/132.png`;
  }
}

// ── Sprite Preloading ──

/** Set of URLs already queued for preload (avoid duplicates) */
const preloaded = new Set<string>();

/** Preload a single image URL. Returns immediately, loads in background. */
function preloadUrl(url: string): void {
  if (!url || preloaded.has(url)) return;
  preloaded.add(url);
  const img = new Image();
  img.src = url;
}

/** Preload all sprite variants for a single species name (front GIF, back GIF, front PNG, back PNG) */
export function preloadSpecies(name: string): void {
  if (!name) return;
  const num = getDexNum(name);
  if (!num) return;
  // Animated GIFs (front + back)
  preloadUrl(`${BASE}/other/showdown/${num}.gif`);
  preloadUrl(`${BASE}/other/showdown/back/${num}.gif`);
  // Static PNG fallbacks
  preloadUrl(`${BASE}/${num}.png`);
  preloadUrl(`${BASE}/back/${num}.png`);
}

/**
 * Preload sprites for an array of species names.
 * Call with team pokemon names when battle starts or when request arrives.
 */
export function preloadSprites(names: string[]): void {
  for (const name of names) {
    preloadSpecies(name);
  }
}

/**
 * Parse species names from a Showdown team paste and preload their sprites.
 * Showdown paste format has species on lines that don't start with whitespace
 * and often look like "Garchomp @ Rocky Helmet" or just "Garchomp".
 */
export function preloadFromPaste(paste: string): void {
  if (!paste) return;
  const lines = paste.split('\n');
  const names: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('-') || trimmed.startsWith('EVs:') ||
        trimmed.startsWith('IVs:') || trimmed.startsWith('Ability:') ||
        trimmed.startsWith('Level:') || trimmed.startsWith('Shiny:') ||
        trimmed.startsWith('Happiness:') || trimmed.startsWith('Tera Type:') ||
        trimmed.startsWith('Gigantamax:')) continue;
    // Species line: "Nickname (Species) @ Item" or "Species @ Item" or just "Species"
    const atIdx = trimmed.indexOf(' @ ');
    const beforeItem = atIdx >= 0 ? trimmed.slice(0, atIdx).trim() : trimmed;
    // Check for parenthetical species: "Nickname (Species)"
    const parenMatch = beforeItem.match(/\(([^)]+)\)\s*$/);
    const species = parenMatch ? parenMatch[1].trim() : beforeItem;
    // Only treat it as a species name if it could resolve in dex
    if (species && getDexNum(species)) {
      names.push(species);
    }
  }
  preloadSprites(names);
}

/**
 * Parse a |switch| or |drag| log line and preload that species' sprites.
 * Line format: "|switch|p2a: Garchomp|Garchomp, L78, M|100/100"
 */
export function preloadFromLogLine(line: string): void {
  const parts = line.split('|');
  const cmd = parts[1];
  if (cmd !== 'switch' && cmd !== 'drag' && cmd !== 'replace') return;
  const details = parts[3] ?? '';
  const species = details.split(',')[0].trim();
  if (species) preloadSpecies(species);
}
