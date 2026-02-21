<!--
  EventToast.svelte — Floating live event notifications on the battlefield.
  Shows brief toast-style messages for battle events like:
  "Leftovers restored HP", "Sandstorm rages", "It's super effective!" etc.
  Messages appear, hang for a moment, then fade out.
-->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { visibleLog } from '$lib/stores/animQueue';

  interface Toast {
    id: number;
    text: string;
    type: 'info' | 'damage' | 'heal' | 'status' | 'boost' | 'crit' | 'weather' | 'ability' | 'item';
    exiting: boolean;
  }

  let toasts = $state<Toast[]>([]);
  let nextId = 0;
  let prevLength = 0;

  // Watch visible log for new lines and create toasts
  $effect(() => {
    const log = $visibleLog;
    if (log.length <= prevLength) {
      prevLength = log.length;
      return;
    }
    // Process only newly added lines
    const newLines = log.slice(prevLength);
    prevLength = log.length;

    for (const line of newLines) {
      const toast = lineToToast(line);
      if (toast) {
        addToast(toast.text, toast.type);
      }
    }
  });

  function addToast(text: string, type: Toast['type']) {
    const id = nextId++;
    const toast: Toast = { id, text, type, exiting: false };
    toasts = [...toasts.slice(-4), toast]; // keep max 5

    // Start exit after display time
    setTimeout(() => {
      toasts = toasts.map(t => t.id === id ? { ...t, exiting: true } : t);
    }, 2000);

    // Remove after fade out
    setTimeout(() => {
      toasts = toasts.filter(t => t.id !== id);
    }, 2600);
  }

  function lineToToast(line: string): { text: string; type: Toast['type'] } | null {
    const parts = line.split('|');
    const cmd = parts[1];

    // Skip move/switch/turn/faint — they're obvious from the animation
    if (!cmd) return null;

    switch (cmd) {
      case '-supereffective':
        return { text: "It's super effective!", type: 'crit' };
      case '-resisted':
        return { text: "Not very effective...", type: 'info' };
      case '-crit':
        return { text: 'Critical hit!', type: 'crit' };
      case '-miss':
        return { text: `${nick(parts[2])}'s attack missed!`, type: 'info' };
      case '-immune':
        return { text: `${nick(parts[2])} is immune!`, type: 'info' };
      case '-fail':
        return { text: 'But it failed!', type: 'info' };
      case '-heal': {
        const from = parts.find(s => s.startsWith('[from] '));
        if (from) {
          const source = from.replace('[from] item: ', '').replace('[from] ', '');
          return { text: `${nick(parts[2])}: ${source}`, type: 'heal' };
        }
        return null; // plain heal doesn't need toast, visible from HP bar
      }
      case '-damage': {
        const from = parts.find(s => s.startsWith('[from] '));
        if (from) {
          const source = from.replace('[from] item: ', '').replace('[from] ', '');
          return { text: `${nick(parts[2])} hurt by ${source}`, type: 'damage' };
        }
        return null;
      }
      case '-status': {
        const statusNames: Record<string, string> = {
          brn: 'Burned!', par: 'Paralyzed!', slp: 'Fell asleep!',
          psn: 'Poisoned!', tox: 'Badly poisoned!', frz: 'Frozen!'
        };
        return { text: `${nick(parts[2])}: ${statusNames[parts[3]] ?? parts[3]}`, type: 'status' };
      }
      case '-curestatus':
        return { text: `${nick(parts[2])} was cured!`, type: 'heal' };
      case '-boost':
      case '-unboost': {
        const up = cmd === '-boost';
        const stages = parseInt(parts[4]) || 1;
        const desc = stages >= 3 ? 'drastically' : stages >= 2 ? 'sharply' : '';
        const arrow = up ? '▲' : '▼';
        return {
          text: `${nick(parts[2])} ${parts[3]} ${desc} ${arrow}`.trim(),
          type: 'boost'
        };
      }
      case '-ability': {
        return { text: `[${nick(parts[2])}'s ${parts[3]}]`, type: 'ability' };
      }
      case '-item':
        return { text: `${nick(parts[2])} has ${parts[3]}!`, type: 'item' };
      case '-enditem':
        return { text: `${nick(parts[2])}'s ${parts[3]} was used!`, type: 'item' };
      case '-weather': {
        const w = parts[2];
        if (w === 'none') return { text: 'Weather cleared', type: 'weather' };
        const from = parts.find(s => s.startsWith('[from] '));
        if (!from) return { text: `${w}`, type: 'weather' };
        return null;
      }
      case '-sidestart':
        return { text: `${parts[3]} set!`, type: 'info' };
      case '-sideend':
        return { text: `${parts[3]} cleared!`, type: 'info' };
      case '-activate': {
        return { text: `${nick(parts[2])}'s ${parts[3]}!`, type: 'ability' };
      }
      case '-mega':
        return { text: `${nick(parts[2])} Mega Evolved!`, type: 'crit' };
      case '-terastallize':
        return { text: `${nick(parts[2])} Terastallized!`, type: 'crit' };
      case 'cant': {
        const r = parts[3] ?? '';
        if (r === 'par') return { text: `${nick(parts[2])} is paralyzed!`, type: 'status' };
        if (r === 'slp') return { text: `${nick(parts[2])} is asleep.`, type: 'status' };
        if (r === 'frz') return { text: `${nick(parts[2])} is frozen!`, type: 'status' };
        if (r === 'flinch') return { text: `${nick(parts[2])} flinched!`, type: 'status' };
        return null;
      }
      default:
        return null;
    }
  }

  function nick(ident: string): string {
    if (!ident) return '???';
    return ident.replace(/^p[12][a-c]?:\s*/, '');
  }
</script>

<div class="toast-container">
  {#each toasts as toast (toast.id)}
    <div class="toast toast-{toast.type}" class:toast-exit={toast.exiting}>
      {toast.text}
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: absolute;
    top: 40px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 25;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    pointer-events: none;
    max-width: 90%;
  }

  .toast {
    padding: 4px 14px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.3px;
    white-space: nowrap;
    backdrop-filter: blur(8px);
    animation: toastIn 0.25s ease-out forwards;
    transform-origin: center top;
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
  }

  .toast-exit {
    animation: toastOut 0.5s ease-in forwards;
  }

  /* Type-specific colors */
  .toast-info     { background: rgba(30, 40, 70, 0.85); color: #93c5fd; border: 1px solid rgba(59,130,246,0.3); }
  .toast-damage   { background: rgba(60, 20, 20, 0.85); color: #fca5a5; border: 1px solid rgba(248,113,113,0.3); }
  .toast-heal     { background: rgba(20, 50, 30, 0.85); color: #86efac; border: 1px solid rgba(74,222,128,0.3); }
  .toast-status   { background: rgba(50, 20, 60, 0.85); color: #d8b4fe; border: 1px solid rgba(192,132,252,0.3); }
  .toast-boost    { background: rgba(20, 45, 55, 0.85); color: #67e8f9; border: 1px solid rgba(103,232,249,0.3); }
  .toast-crit     { background: rgba(70, 40, 10, 0.85); color: #fde047; border: 1px solid rgba(253,224,71,0.4); }
  .toast-weather  { background: rgba(30, 40, 55, 0.85); color: #7dd3fc; border: 1px solid rgba(125,211,252,0.3); }
  .toast-ability  { background: rgba(35, 30, 60, 0.85); color: #a5b4fc; border: 1px solid rgba(165,180,252,0.3); }
  .toast-item     { background: rgba(55, 40, 25, 0.85); color: #fbbf24; border: 1px solid rgba(251,191,36,0.3); }

  @keyframes toastIn {
    0%   { transform: translateY(-10px) scale(0.85); opacity: 0; }
    100% { transform: translateY(0) scale(1); opacity: 1; }
  }
  @keyframes toastOut {
    0%   { transform: translateY(0) scale(1); opacity: 1; }
    100% { transform: translateY(-8px) scale(0.9); opacity: 0; }
  }
</style>
