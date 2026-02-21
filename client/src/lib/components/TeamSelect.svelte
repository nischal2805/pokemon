<script lang="ts">
  import { iconUrl, onSpriteError } from '$lib/sprites';

  interface Props {
    request: any;
    onsubmit: (order: string) => void;
  }
  let { request, onsubmit }: Props = $props();

  let pokemon = $derived(request?.side?.pokemon ?? []);
  let selectedLead = $state(0);

  function parseName(ident: string): string {
    if (!ident) return '???';
    const parts = ident.split(': ');
    return parts.length > 1 ? parts[1] : ident;
  }

  function getSpecies(poke: any): string {
    return poke.details?.split(',')[0]?.trim() ?? parseName(poke.ident);
  }

  /* iconUrl imported from $lib/sprites */

  function submit() {
    const order = [];
    order.push(selectedLead + 1);
    for (let i = 0; i < pokemon.length; i++) {
      if (i !== selectedLead) order.push(i + 1);
    }
    onsubmit(order.join(''));
  }
</script>

<div class="team-select rounded-2xl p-5">
  <div class="text-center mb-4">
    <h3 class="text-sm font-bold uppercase tracking-wider text-white/50 mb-1">👁️ Team Preview</h3>
    <p class="text-xs text-white/30">Choose your lead Pokémon</p>
  </div>

  <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
    {#each pokemon as poke, i}
      {@const species = getSpecies(poke)}
      <button
        onclick={() => selectedLead = i}
        class="team-card rounded-xl p-3 text-center transition-all
          {selectedLead === i ? 'selected-card' : 'idle-card'}"
      >
        <img
          src={iconUrl(species)}
          alt={species}
          class="w-16 h-16 mx-auto object-contain drop-shadow-md"
          style="image-rendering: pixelated;"
          onerror={onSpriteError}
        />
        <div class="font-bold text-xs text-white mt-1 truncate">{parseName(poke.ident)}</div>
        <div class="text-[10px] text-white/40">
          {poke.details?.split(',').slice(0, 2).join(', ') ?? ''}
        </div>
        {#if selectedLead === i}
          <div class="mt-1">
            <span class="inline-block text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
              ★ LEAD
            </span>
          </div>
        {/if}
      </button>
    {/each}
  </div>

  <button onclick={submit}
    class="w-full py-3 rounded-xl font-bold text-sm transition-all
      bg-gradient-to-r from-[var(--accent)] to-pink-600
      hover:from-[var(--accent-hover)] hover:to-pink-500
      active:scale-[0.98]
      shadow-lg shadow-[var(--accent)]/20">
    ⚔️ Start Battle!
  </button>
</div>

<style>
  .team-select {
    background: linear-gradient(135deg, rgba(15, 25, 60, 0.9), rgba(10, 18, 40, 0.95));
    border: 1px solid rgba(255,255,255,0.06);
  }

  .team-card {
    border: 2px solid transparent;
    background: rgba(255,255,255,0.03);
  }

  .idle-card {
    border-color: rgba(255,255,255,0.06);
    cursor: pointer;
  }
  .idle-card:hover {
    background: rgba(255,255,255,0.06);
    border-color: rgba(255,255,255,0.15);
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0,0,0,0.3);
  }

  .selected-card {
    border-color: #e94560;
    background: rgba(233, 69, 96, 0.08);
    box-shadow: 0 0 20px rgba(233, 69, 96, 0.15);
    transform: translateY(-2px);
  }
</style>
