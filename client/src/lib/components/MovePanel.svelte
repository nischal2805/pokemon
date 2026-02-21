<script lang="ts">
  interface Props {
    request: any;
    onmove: (slot: number, mega?: boolean, zmove?: boolean, tera?: string) => void;
  }
  let { request, onmove }: Props = $props();

  // Type colors
  const TYPE_COLORS: Record<string, string> = {
    Normal: '#A8A878', Fire: '#F08030', Water: '#6890F0', Electric: '#F8D030',
    Grass: '#78C850', Ice: '#98D8D8', Fighting: '#C03028', Poison: '#A040A0',
    Ground: '#E0C068', Flying: '#A890F0', Psychic: '#F85888', Bug: '#A8B820',
    Rock: '#B8A038', Ghost: '#705898', Dragon: '#7038F8', Dark: '#705848',
    Steel: '#B8B8D0', Fairy: '#EE99AC', '???': '#68A090',
  };

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

<div class="bg-[var(--bg-secondary)] rounded-xl p-4">
  <div class="flex items-center justify-between mb-3">
    <h3 class="text-sm font-semibold text-[var(--text-muted)]">Moves</h3>
    <div class="flex gap-2">
      {#if canMega}
        <button
          onclick={() => { wantMega = !wantMega; wantZMove = false; teraType = ''; }}
          class="px-2 py-0.5 rounded text-xs font-medium transition-colors
            {wantMega ? 'bg-purple-600 text-white' : 'bg-[var(--bg-card)] text-[var(--text-muted)]'}"
        >Mega</button>
      {/if}
      {#if canZMove}
        <button
          onclick={() => { wantZMove = !wantZMove; wantMega = false; teraType = ''; }}
          class="px-2 py-0.5 rounded text-xs font-medium transition-colors
            {wantZMove ? 'bg-yellow-600 text-white' : 'bg-[var(--bg-card)] text-[var(--text-muted)]'}"
        >Z-Move</button>
      {/if}
      {#if canTera}
        <button
          onclick={() => { teraType = teraType ? '' : activeData.canTerastallize; wantMega = false; wantZMove = false; }}
          class="px-2 py-0.5 rounded text-xs font-medium transition-colors
            {teraType ? 'bg-cyan-600 text-white' : 'bg-[var(--bg-card)] text-[var(--text-muted)]'}"
        >Tera {activeData.canTerastallize}</button>
      {/if}
    </div>
  </div>

  {#if trapped}
    <p class="text-xs text-red-400 mb-2">You are trapped and cannot switch!</p>
  {/if}

  <div class="grid grid-cols-2 gap-2">
    {#each moves as move, i}
      {@const typeColor = TYPE_COLORS[move.type ?? '???'] ?? TYPE_COLORS['???']}
      <button
        onclick={() => clickMove(i)}
        disabled={move.disabled || move.pp === 0}
        class="relative rounded-lg p-3 text-left transition-all
          {move.disabled || move.pp === 0 ? 'opacity-40 cursor-not-allowed' : 'hover:scale-[1.02] hover:brightness-110 cursor-pointer'}
          text-white font-medium text-sm"
        style="background-color: {typeColor}; box-shadow: 0 2px 8px {typeColor}40;"
      >
        <div class="font-semibold">{move.move}</div>
        <div class="flex justify-between items-center mt-1 text-xs opacity-80">
          <span>{move.type ?? '???'}</span>
          <span>{move.pp ?? '?'}/{move.maxpp ?? '?'} PP</span>
        </div>
      </button>
    {/each}
  </div>
</div>
