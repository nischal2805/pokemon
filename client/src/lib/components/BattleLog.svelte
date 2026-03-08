<script lang="ts">
  import { tick } from 'svelte';
  import { visibleLog, isAnimating, skipToEnd } from '$lib/stores/animQueue';

  let logContainer: HTMLDivElement | undefined = $state();

  // Auto-scroll when new visible lines appear
  $effect(() => {
    $visibleLog;
    tick().then(() => {
      if (logContainer) logContainer.scrollTop = logContainer.scrollHeight;
    });
  });

  /** Strip "p1a: " / "p2a: " prefix → just the pokemon name */
  function nick(ident: string): string {
    if (!ident) return '???';
    return ident.replace(/^p[12][a-c]?:\s*/, '');
  }

  function formatLine(line: string): { html: string; cls: string } | null {
    if (line.startsWith('|turn|')) {
      const turn = line.split('|')[2];
      return { html: `<span class="turn-inner">── Turn ${turn} ──</span>`, cls: 'turn' };
    }
    if (line.startsWith('|win|'))
      return { html: `🎉 <b>${line.split('|')[2]}</b> won the battle!`, cls: 'win' };
    if (line === '|tie' || line.startsWith('|tie|'))
      return { html: `🤝 The battle ended in a tie!`, cls: 'tie' };
    if (line.startsWith('|move|')) {
      const p = line.split('|');
      return { html: `<b>${nick(p[2])}</b> used <b>${p[3]}</b>!`, cls: 'move' };
    }
    if (line.startsWith('|switch|') || line.startsWith('|drag|')) {
      const p = line.split('|');
      const species = p[3]?.split(',')[0] ?? nick(p[2]);
      const verb = line.startsWith('|drag|') ? 'was dragged out!' : 'was sent out!';
      return { html: `<b>${species}</b> ${verb}`, cls: 'switch' };
    }
    if (line.startsWith('|faint|'))
      return { html: `💀 <b>${nick(line.split('|')[2])}</b> fainted!`, cls: 'faint' };
    if (line.startsWith('|-damage|')) {
      const p = line.split('|');
      const hp = p[3]?.split(' ')[0] ?? '';
      const from = p.find(s => s.startsWith('[from] '));
      if (from) return { html: `<b>${nick(p[2])}</b> was hurt by ${from.replace('[from] ', '')}! <span class="hp">(${hp})</span>`, cls: 'damage' };
      return { html: `<b>${nick(p[2])}</b> took damage! <span class="hp">(${hp})</span>`, cls: 'damage' };
    }
    if (line.startsWith('|-heal|')) {
      const p = line.split('|');
      const hp = p[3]?.split(' ')[0] ?? '';
      const from = p.find(s => s.startsWith('[from] '));
      if (from) return { html: `<b>${nick(p[2])}</b> healed via ${from.replace('[from] ', '')}! <span class="hp">(${hp})</span>`, cls: 'heal' };
      return { html: `<b>${nick(p[2])}</b> healed! <span class="hp">(${hp})</span>`, cls: 'heal' };
    }
    if (line.startsWith('|-supereffective|'))
      return { html: `It's super effective!`, cls: 'supereffective' };
    if (line.startsWith('|-resisted|'))
      return { html: `It's not very effective...`, cls: 'resisted' };
    if (line.startsWith('|-crit|'))
      return { html: `<i>A critical hit!</i>`, cls: 'crit' };
    if (line.startsWith('|-miss|'))
      return { html: `<b>${nick(line.split('|')[2])}</b>'s attack missed!`, cls: 'miss' };
    if (line.startsWith('|-immune|'))
      return { html: `It doesn't affect <b>${nick(line.split('|')[2])}</b>...`, cls: 'immune' };
    if (line.startsWith('|-fail|'))
      return { html: `But it failed!`, cls: 'miss' };
    if (line.startsWith('|-status|')) {
      const p = line.split('|');
      const names: Record<string, string> = { brn: 'burned', par: 'paralyzed', slp: 'fell asleep', psn: 'poisoned', tox: 'badly poisoned', frz: 'frozen' };
      return { html: `<b>${nick(p[2])}</b> was ${names[p[3]] ?? p[3]}!`, cls: 'status' };
    }
    if (line.startsWith('|-curestatus|'))
      return { html: `<b>${nick(line.split('|')[2])}</b> was cured!`, cls: 'heal' };
    if (line.startsWith('|-boost|') || line.startsWith('|-unboost|')) {
      const p = line.split('|');
      const up = line.startsWith('|-boost|');
      const stages = parseInt(p[4]) || 1;
      const desc = stages >= 3 ? 'drastically ' : stages >= 2 ? 'sharply ' : '';
      return { html: `<b>${nick(p[2])}</b>'s ${p[3]} ${desc}${up ? 'rose' : 'fell'}!`, cls: up ? 'boost' : 'unboost' };
    }
    if (line.startsWith('|-ability|'))
      return { html: `<i>[${nick(line.split('|')[2])}'s ${line.split('|')[3]}]</i>`, cls: 'ability' };
    if (line.startsWith('|-item|'))
      return { html: `<b>${nick(line.split('|')[2])}</b> revealed <b>${line.split('|')[3]}</b>!`, cls: 'item' };
    if (line.startsWith('|-enditem|'))
      return { html: `<b>${nick(line.split('|')[2])}</b>'s <b>${line.split('|')[3]}</b> was used up!`, cls: 'item' };
    if (line.startsWith('|-weather|')) {
      const w = line.split('|')[2];
      if (w === 'none') return { html: `The weather cleared.`, cls: 'weather' };
      const from = line.split('|').find(s => s.startsWith('[from] '));
      if (from) return { html: `${w} started! (${from.replace('[from] ', '')})`, cls: 'weather' };
      return { html: `(${w})`, cls: 'weather-cont' };
    }
    if (line.startsWith('|-sidestart|')) {
      const p = line.split('|');
      return { html: `${p[3]} was set on ${nick(p[2])}'s side!`, cls: 'hazard' };
    }
    if (line.startsWith('|-sideend|')) {
      const p = line.split('|');
      return { html: `${p[3]} was removed from ${nick(p[2])}'s side!`, cls: 'hazard' };
    }
    if (line.startsWith('|-activate|'))
      return { html: `${nick(line.split('|')[2])}'s ${line.split('|')[3]} activated!`, cls: 'ability' };
    if (line.startsWith('|-mega|'))
      return { html: `🌟 <b>${nick(line.split('|')[2])}</b> Mega Evolved!`, cls: 'mega' };
    if (line.startsWith('|-terastallize|'))
      return { html: `💎 <b>${nick(line.split('|')[2])}</b> Terastallized into <b>${line.split('|')[3]}</b>!`, cls: 'mega' };
    if (line.startsWith('|detailschange|') || line.startsWith('|-formechange|')) {
      const p = line.split('|');
      return { html: `<b>${nick(p[2])}</b> changed form to <b>${p[3]?.split(',')[0]}</b>!`, cls: 'switch' };
    }
    if (line.startsWith('|-start|')) {
      const p = line.split('|');
      const eff = p[3] ?? '';
      if (eff.includes('confusion')) return { html: `<b>${nick(p[2])}</b> became confused!`, cls: 'status' };
      if (eff.includes('Substitute')) return { html: `<b>${nick(p[2])}</b> put up a substitute!`, cls: 'status' };
      return null;
    }
    if (line.startsWith('|-end|')) {
      const p = line.split('|');
      if ((p[3] ?? '').includes('confusion')) return { html: `<b>${nick(p[2])}</b> snapped out of confusion!`, cls: 'heal' };
      return null;
    }
    if (line.startsWith('|cant|')) {
      const p = line.split('|');
      const r = p[3] ?? '';
      if (r === 'par') return { html: `<b>${nick(p[2])}</b> is paralyzed! It can't move!`, cls: 'status' };
      if (r === 'slp') return { html: `<b>${nick(p[2])}</b> is fast asleep.`, cls: 'status' };
      if (r === 'frz') return { html: `<b>${nick(p[2])}</b> is frozen solid!`, cls: 'status' };
      if (r === 'flinch') return { html: `<b>${nick(p[2])}</b> flinched!`, cls: 'status' };
      return { html: `<b>${nick(p[2])}</b> can't move! (${r})`, cls: 'status' };
    }
    if (line.startsWith('|error|'))
      return { html: `⚠️ ${line.slice(7)}`, cls: 'error' };
    if (line.startsWith('|')) return null;
    if (line.trim()) return { html: line, cls: 'plain' };
    return null;
  }
</script>

<div class="battle-log rounded-xl overflow-hidden h-full flex flex-col">
  <div class="px-4 py-2 bg-[#0d1b3e] border-b border-[#1a2f5e] flex items-center justify-between">
    <h3 class="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Battle Log</h3>
    {#if $isAnimating}
      <button
        onclick={skipToEnd}
        class="text-[10px] font-bold uppercase text-blue-400 bg-blue-400/10 px-2.5 py-1 rounded
          border border-blue-400/20 hover:bg-blue-400/20 transition-all cursor-pointer"
      >
        ⏭ Skip
      </button>
    {/if}
  </div>
  <div bind:this={logContainer}
    class="flex-1 overflow-y-auto px-4 py-2 max-h-[65vh] space-y-0.5 text-[13px] leading-5">
    {#if $visibleLog.length === 0}
      <p class="text-[var(--text-muted)] text-center py-4 text-sm">Waiting for battle to start...</p>
    {:else}
      {#each $visibleLog as line}
        {@const f = formatLine(line)}
        {#if f}
          <div class="log-line {f.cls} log-anim-in">{@html f.html}</div>
        {/if}
      {/each}
    {/if}
  </div>
</div>

<style>
  .battle-log { background: linear-gradient(180deg, #0f1a35, #0a1228); font-family: 'Segoe UI', system-ui, sans-serif; }
  .log-line { padding: 1px 0; }
  .log-line :global(b) { font-weight: 600; }
  .log-line :global(.hp) { opacity: 0.6; font-size: 0.85em; }
  .turn { text-align: center; color: #6b7db3; font-weight: 700; font-size: 0.8em; padding: 6px 0 2px; margin-top: 4px; border-top: 1px solid #1a2f5e; }
  .turn :global(.turn-inner) { background: #111d3a; padding: 2px 12px; border-radius: 8px; }
  .win { color: #4ade80; font-weight: 700; font-size: 1.1em; padding: 8px 0; text-align: center; }
  .tie { color: #fbbf24; font-weight: 700; text-align: center; }
  .move { color: #93c5fd; }
  .switch { color: #fde68a; }
  .faint { color: #f87171; font-weight: 600; }
  .damage { color: #fca5a5; }
  .heal { color: #86efac; }
  .supereffective { color: #fb923c; font-style: italic; padding-left: 12px; }
  .resisted { color: #9ca3af; font-style: italic; padding-left: 12px; }
  .crit { color: #fde047; padding-left: 12px; }
  .miss { color: #6b7280; }
  .immune { color: #6b7280; font-style: italic; }
  .status { color: #c084fc; }
  .boost { color: #67e8f9; }
  .unboost { color: #fdba74; }
  .ability { color: #a5b4fc; font-style: italic; font-size: 0.9em; }
  .item { color: #d4a574; }
  .weather { color: #7dd3fc; }
  .weather-cont { color: #475569; font-size: 0.85em; }
  .hazard { color: #a78bfa; }
  .mega { color: #f0abfc; font-weight: 600; }
  .error { color: #f87171; background: rgba(248, 113, 113, 0.1); padding: 2px 6px; border-radius: 4px; }
  .plain { color: #8892b0; }

  @keyframes logSlideIn {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .log-anim-in {
    animation: logSlideIn 0.2s ease-out both;
  }
</style>
