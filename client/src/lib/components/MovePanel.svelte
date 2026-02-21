<script lang="ts">
  import moveDetailsData from '$lib/moveDetails.json';

  interface Props {
    request: any;
    onmove: (slot: number, mega?: boolean, zmove?: boolean, tera?: string) => void;
  }
  let { request, onmove }: Props = $props();

  const moveDetails: Record<string, { accuracy: number; power: number; type: string; category: string }> = moveDetailsData;

  const TYPE_COLORS: Record<string, string> = {
    Normal: '#A8A878', Fire: '#F08030', Water: '#6890F0', Electric: '#F8D030',
    Grass: '#78C850', Ice: '#98D8D8', Fighting: '#C03028', Poison: '#A040A0',
    Ground: '#E0C068', Flying: '#A890F0', Psychic: '#F85888', Bug: '#A8B820',
    Rock: '#B8A038', Ghost: '#705898', Dragon: '#7038F8', Dark: '#705848',
    Steel: '#B8B8D0', Fairy: '#EE99AC', '???': '#68A090',
  };

  const CATEGORY_ICONS: Record<string, string> = {
    Physical: '💥', Special: '🌀', Status: '✨',
  };

  function getMoveInfo(move: any) {
    const id = (move.id || move.move || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return moveDetails[id] ?? null;
  }

  let activeData = $derived(request?.active?.[0]);
  let moves = $derived(activeData?.moves ?? []);
  let canMega = $derived(!!activeData?.canMegaEvo);
  let canZMove = $derived(!!activeData?.canZMove);
  let canTera = $derived(!!activeData?.canTerastallize);
  let trapped = $derived(!!activeData?.trapped || !!activeData?.maybeTrapped);

  let wantMega = $state(false);
  let wantZMove = $state(false);
  let teraType = $state('');

  function clickMove(idx: number) {
    const move = moves[idx];
    if (move.disabled) return;
    onmove(idx + 1, wantMega, wantZMove, teraType || undefined);
    wantMega = false;
    wantZMove = false;
    teraType = '';
  }
</script>

<div class="move-panel rounded-2xl p-4">
  <!-- Gimmick toggles -->
  <div class="flex items-center justify-between mb-3">
    <h3 class="text-xs font-bold uppercase tracking-wider text-white/40">⚔️ Moves</h3>
    <div class="flex gap-2">
      {#if canMega}
        <button
          onclick={() => { wantMega = !wantMega; wantZMove = false; teraType = ''; }}
          class="gimmick-btn {wantMega ? 'gimmick-active gimmick-mega' : ''}"
        >
          <span class="text-sm">🧬</span> Mega
        </button>
      {/if}
      {#if canZMove}
        <button
          onclick={() => { wantZMove = !wantZMove; wantMega = false; teraType = ''; }}
          class="gimmick-btn {wantZMove ? 'gimmick-active gimmick-z' : ''}"
        >
          <span class="text-sm">⚡</span> Z-Move
        </button>
      {/if}
      {#if canTera}
        <button
          onclick={() => { teraType = teraType ? '' : activeData.canTerastallize; wantMega = false; wantZMove = false; }}
          class="gimmick-btn {teraType ? 'gimmick-active gimmick-tera' : ''}"
        >
          <span class="text-sm">💎</span> Tera {activeData.canTerastallize}
        </button>
      {/if}
    </div>
  </div>

  {#if trapped}
    <div class="flex items-center gap-2 mb-3 px-3 py-1.5 rounded-lg bg-red-900/30 border border-red-800/40">
      <span class="text-sm">🔒</span>
      <span class="text-xs text-red-300 font-medium">You are trapped and cannot switch!</span>
    </div>
  {/if}

  <div class="grid grid-cols-2 gap-2.5">
    {#each moves as move, i}
      {@const info = getMoveInfo(move)}
      {@const typeColor = TYPE_COLORS[info?.type ?? move.type ?? '???'] ?? TYPE_COLORS['???']}
      {@const ppLow = move.pp !== undefined && move.maxpp !== undefined && move.pp <= move.maxpp * 0.25}
      {@const acc = info ? (info.accuracy === 0 ? '—' : info.accuracy + '%') : '—'}
      {@const pow = info ? (info.power > 0 ? info.power : '—') : '—'}
      {@const cat = info?.category ?? 'Status'}
      <button
        onclick={() => clickMove(i)}
        disabled={move.disabled || move.pp === 0}
        class="move-btn rounded-xl p-3 text-left transition-all relative
          {move.disabled || move.pp === 0 ? 'opacity-30 cursor-not-allowed grayscale' : 'hover:scale-[1.03] hover:brightness-110 cursor-pointer active:scale-[0.97]'}"
        style="background: linear-gradient(135deg, {typeColor}dd, {typeColor}88);
               box-shadow: 0 3px 12px {typeColor}40, inset 0 1px 0 rgba(255,255,255,0.15);"
      >
        <!-- Move name -->
        <div class="font-bold text-sm text-white drop-shadow-sm">{move.move}</div>

        <!-- Accuracy + Power + Category + PP -->
        <div class="flex items-center justify-between mt-1.5">
          <div class="flex items-center gap-1.5">
            <span class="move-stat-badge" title="Accuracy">
              🎯 {acc}
            </span>
            {#if pow !== '—'}
              <span class="move-stat-badge" title="Power">
                ⚔️ {pow}
              </span>
            {/if}
            <span class="move-stat-badge" title="Category">
              {CATEGORY_ICONS[cat] ?? '✨'} {cat}
            </span>
          </div>
          <span class="text-[10px] font-bold {ppLow ? 'text-red-200' : 'text-white/60'}">
            {move.pp ?? '?'}/{move.maxpp ?? '?'} PP
          </span>
        </div>
      </button>
    {/each}
  </div>
</div>

<style>
  .move-panel {
    background: linear-gradient(135deg, rgba(15, 25, 60, 0.9), rgba(10, 18, 40, 0.95));
    border: 1px solid rgba(255,255,255,0.06);
  }

  .gimmick-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 600;
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.5);
    border: 1px solid rgba(255,255,255,0.08);
    transition: all 0.2s;
    cursor: pointer;
  }
  .gimmick-btn:hover { background: rgba(255,255,255,0.12); }
  .gimmick-active { color: white; }
  .gimmick-mega  { background: linear-gradient(135deg, #9333ea, #7c3aed); border-color: #a855f7; box-shadow: 0 0 12px rgba(147,51,234,0.4); }
  .gimmick-z     { background: linear-gradient(135deg, #d97706, #b45309); border-color: #f59e0b; box-shadow: 0 0 12px rgba(217,119,6,0.4); }
  .gimmick-tera  { background: linear-gradient(135deg, #0891b2, #0e7490); border-color: #06b6d4; box-shadow: 0 0 12px rgba(8,145,178,0.4); }

  .move-stat-badge {
    font-size: 9px;
    font-weight: 600;
    color: rgba(255,255,255,0.75);
    background: rgba(0,0,0,0.25);
    padding: 1px 5px;
    border-radius: 4px;
    white-space: nowrap;
  }
</style>
