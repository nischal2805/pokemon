/**
 * Battle animation queue — replays log lines with timed delays
 * so battles feel like Showdown (each event visible before the next).
 * 
 * The server sends all turn events as one big log chunk.
 * Instead of rendering them all at once, we feed them through
 * a queue with per-event delays, creating the Showdown-style
 * "replay" feel where you see each move/damage/status happen.
 */
import { writable, get } from 'svelte/store';

/** Lines that have been "played" and are visible to the UI */
export const visibleLog = writable<string[]>([]);

/** Whether animation is currently playing */
export const isAnimating = writable(false);

/** Current animation state for sprite effects */
export const animEvent = writable<{
  type: string;        // 'move' | 'damage' | 'faint' | 'switch' | 'heal' | 'status' | 'supereffective' | 'boost' | 'none'
  target?: 'my' | 'opp';   // which sprite to animate
  value?: string;      // extra info (move name, status, etc)
} | null>(null);

// Internal queue of pending lines
let queue: string[] = [];
let playing = false;
let skipMode = false;
let playId = 0; // Monotonic ID to detect stale playQueue instances

/** Get delay in ms for a given protocol line */
function getDelay(line: string): number {
  if (skipMode) return 0;
  const parts = line.split('|');
  const cmd = parts[1];
  switch (cmd) {
    case 'turn':            return 1050;
    case 'move':            return 1150;
    case 'switch':
    case 'drag':            return 950;
    case '-damage':         return 850;
    case '-heal':           return 750;
    case 'faint':           return 1250;
    case '-supereffective': return 650;
    case '-resisted':       return 550;
    case '-crit':           return 600;
    case '-miss':
    case '-fail':           return 750;
    case '-immune':         return 650;
    case '-status':         return 750;
    case '-curestatus':     return 650;
    case '-boost':
    case '-unboost':        return 650;
    case '-ability':        return 550;
    case '-item':
    case '-enditem':        return 600;
    case '-weather':        return 650;
    case '-sidestart':
    case '-sideend':        return 600;
    case '-terastallize':
    case '-mega':           return 1050;
    case '-formechange':
    case 'detailschange':   return 750;
    case 'win':
    case 'tie':             return 750;
    case '-activate':       return 550;
    case '-start':
    case '-end':            return 550;
    case 'cant':            return 750;
    default:                return 300;
  }
}

/** Determine what sprite animation should play for this line */
function getAnimEvent(line: string, mySide: string): {
  type: string; target?: 'my' | 'opp'; value?: string;
} | null {
  const parts = line.split('|');
  const cmd = parts[1];
  const ident = parts[2] ?? '';
  const isMyPoke = ident.startsWith(`${mySide}a:`) || ident.startsWith(`${mySide}: `);
  const target: 'my' | 'opp' = isMyPoke ? 'my' : 'opp';

  switch (cmd) {
    case 'move':
      return { type: 'move', target: isMyPoke ? 'my' : 'opp', value: parts[3] };
    case '-damage':
      return { type: 'damage', target };
    case '-heal':
      return { type: 'heal', target };
    case 'faint':
      return { type: 'faint', target };
    case 'switch':
    case 'drag':
      return { type: 'switch', target };
    case '-supereffective':
      return { type: 'supereffective' };
    case '-status':
      return { type: 'status', target, value: parts[3] };
    case '-boost':
    case '-unboost':
      return { type: 'boost', target };
    case '-terastallize':
    case '-mega':
      return { type: 'mega', target };
    default:
      return null;
  }
}

/** The main playback loop */
async function playQueue(mySide: string) {
  if (playing) return;
  playing = true;
  isAnimating.set(true);
  const myId = ++playId; // Capture ID so we can detect if skipToEnd invalidated us

  while (queue.length > 0) {
    // If skipToEnd was called, this instance is stale — bail out
    if (myId !== playId) return;

    const line = queue.shift()!;
    const parts = line.split('|');
    const cmd = parts[1];

    // Set animation event for sprite effects
    const anim = getAnimEvent(line, mySide);

    // For switch events, use a two-phase approach:
    // Phase 1: briefly clear the old sprite
    // Phase 2: show the new sprite with slide-in animation
    if (cmd === 'switch' || cmd === 'drag') {
      // Phase 1: signal that a switch-out is happening (hides sprite briefly)
      animEvent.set({ type: 'switch-out', target: anim?.target });
      await sleep(250);

      // Phase 2: add the line (new sprite appears) and play slide-in
      visibleLog.update(v => [...v, line]);
      if (anim) animEvent.set(anim);
      const delay = getDelay(line);
      if (delay > 0) await sleep(delay);
      if (anim) animEvent.set(null);
    }
    // For damage/heal: show the animation FIRST, then update HP after
    else if (cmd === '-damage' || cmd === '-heal') {
      if (anim) animEvent.set(anim);
      // Let the hit/heal animation play for a moment before HP updates
      await sleep(400);
      // Now add line to visible log (HP updates)
      visibleLog.update(v => [...v, line]);
      // Wait remaining delay
      const remaining = getDelay(line) - 400;
      if (remaining > 0) await sleep(remaining);
      if (anim) animEvent.set(null);
    }
    // For move events: play sprite animation first, then show log text ~250ms later
    // so the visual leads the text (matches how Showdown feels)
    else {
      if (anim) animEvent.set(anim);
      const delay = getDelay(line);
      const textDelay = (anim && cmd === 'move') ? Math.min(250, delay) : 0;
      if (textDelay > 0) await sleep(textDelay);
      visibleLog.update(v => [...v, line]);
      const remaining = delay - textDelay;
      if (remaining > 0) await sleep(remaining);
      if (anim) animEvent.set(null);
    }
  }

  playing = false;
  isAnimating.set(false);
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/** Enqueue new log lines from a battleUpdate event */
export function enqueueLines(lines: string[], mySide: string) {
  queue.push(...lines);
  if (!playing) {
    playQueue(mySide);
  }
}

/** Skip to end — instantly show all remaining lines */
export function skipToEnd() {
  skipMode = true;
  playId++; // Invalidate any in-flight playQueue
  // Flush remaining queue immediately
  if (queue.length > 0) {
    visibleLog.update(v => [...v, ...queue]);
    queue = [];
  }
  skipMode = false;
  playing = false;
  isAnimating.set(false);
  animEvent.set(null);
}

/** Reset for a new battle */
export function resetAnimQueue() {
  queue = [];
  playing = false;
  skipMode = false;
  playId++; // Invalidate any in-flight playQueue
  visibleLog.set([]);
  isAnimating.set(false);
  animEvent.set(null);
}
