<script lang="ts">
  import HPBar from './HPBar.svelte';
  import { iconUrl, onSpriteError } from '$lib/sprites';

  interface Props {
    request: any;
    forceSwitch: boolean;
    onswitch: (slot: number) => void;
  }
  let { request, forceSwitch, onswitch }: Props = $props();

  let pokemon = $derived(request?.side?.pokemon ?? []);
  let trapped = $derived(!forceSwitch && (request?.active?.[0]?.trapped || request?.active?.[0]?.maybeTrapped));

  let hoveredIdx = $state<number | null>(null);

  function getHPPercent(condition: string): number {
    if (!condition || condition === '0 fnt') return 0;
    const parts = condition.split(' ')[0].split('/');
    if (parts.length !== 2) return 100;
    return Math.round((parseInt(parts[0]) / parseInt(parts[1])) * 100);
  }

  function isFainted(condition: string): boolean {
    return !condition || condition === '0 fnt';
  }

  function parseName(ident: string): string {
    if (!ident) return '???';
    const parts = ident.split(': ');
    return parts.length > 1 ? parts[1] : ident;
  }

  function getStatus(condition: string): string {
    if (!condition) return '';
    const parts = condition.split(' ');
    if (parts.length > 1 && parts[1] !== 'fnt') return parts[1];
    return '';
  }

  function canSwitch(poke: any): boolean {
    if (poke.active && !forceSwitch) return false;
    if (isFainted(poke.condition)) return false;
    if (trapped) return false;
    return true;
  }

  function getSpecies(poke: any): string {
    return poke.details?.split(',')[0]?.trim() ?? parseName(poke.ident);
  }

  function formatAbility(a: string): string {
    if (!a) return '—';
    // Convert camelCase or id to readable: "intimidate" -> "Intimidate"
    return a.replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/^./, s => s.toUpperCase());
  }

  function formatMoves(poke: any): string[] {
    return (poke.moves ?? []).map((m: string) =>
      m.replace(/([a-z])([A-Z])/g, '$1 $2')
       .replace(/^./, (s: string) => s.toUpperCase())
    );
  }
</script>

<div class="party-panel rounded-2xl p-4">
  <div class="flex items-center gap-2 mb-3">
    {#if forceSwitch}
      <span class="text-sm">⚠️</span>
      <h3 class="text-xs font-bold uppercase tracking-wider text-amber-400">Choose a Pokémon!</h3>
    {:else}
      <span class="text-sm">🎒</span>
      <h3 class="text-xs font-bold uppercase tracking-wider text-white/40">Party</h3>
    {/if}
  </div>

  {#if trapped && !forceSwitch}
    <div class="flex items-center gap-2 mb-3 px-3 py-1.5 rounded-lg bg-red-900/30 border border-red-800/40">
      <span class="text-sm">🔒</span>
      <span class="text-xs text-red-300 font-medium">Trapped — cannot switch!</span>
    </div>
  {/if}

  <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
    {#each pokemon as poke, i}
      {@const fainted = isFainted(poke.condition)}
      {@const switchable = canSwitch(poke)}
      {@const species = getSpecies(poke)}
      {@const status = getStatus(poke.condition)}
      <div class="relative">
        <button
          onclick={() => switchable && onswitch(i + 1)}
          onmouseenter={() => hoveredIdx = i}
          onmouseleave={() => hoveredIdx = null}
          disabled={!switchable}
          class="party-slot rounded-xl p-2.5 text-left transition-all relative w-full
            {poke.active && !forceSwitch ? 'ring-2 ring-blue-400 active-slot' : ''}
            {fainted ? 'fainted-slot' : switchable ? 'switchable-slot' : 'locked-slot'}"
        >
          <!-- Mini sprite + name row -->
          <div class="flex items-center gap-2">
            <img
              src={iconUrl(species)}
              alt={species}
              class="w-10 h-10 object-contain {fainted ? 'grayscale opacity-40' : ''}"
              style="image-rendering: pixelated;"
              onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div class="flex-1 min-w-0">
              <div class="font-bold text-xs text-white truncate">
                {parseName(poke.ident)}
              </div>
              {#if poke.active && !forceSwitch}
                <span class="text-[9px] font-semibold text-blue-400">IN BATTLE</span>
              {/if}
            </div>
          </div>

          <!-- HP + status -->
          {#if !fainted}
            <div class="mt-1.5">
              <HPBar percent={getHPPercent(poke.condition)} size="sm" />
              <div class="flex items-center justify-between mt-1">
                <span class="text-[10px] text-white/40">{poke.condition?.split(' ')[0] ?? ''}</span>
                {#if status}
                  <span class="status-badge status-{status}">{status.toUpperCase()}</span>
                {/if}
              </div>
            </div>
          {:else}
            <div class="mt-1.5 text-center">
              <span class="text-[10px] font-bold text-red-400/80 uppercase tracking-wider">Fainted</span>
            </div>
          {/if}

          <!-- Item -->
          {#if poke.item}
            <div class="text-[9px] text-yellow-300/60 mt-0.5 truncate">📦 {poke.item}</div>
          {/if}
        </button>

        <!-- Hover tooltip with detailed info -->
        {#if hoveredIdx === i && !fainted}
          <div class="tooltip-card absolute z-50 left-0 right-0 -top-2 -translate-y-full
            bg-[#0d1b3e]/95 backdrop-blur-md border border-white/10 rounded-lg p-3 shadow-xl
            text-xs pointer-events-none min-w-[200px]">
            <div class="font-bold text-white text-sm mb-1.5">{getSpecies(poke)}</div>

            {#if poke.ability}
              <div class="flex items-center gap-1.5 mb-1">
                <span class="text-white/40">Ability:</span>
                <span class="text-cyan-300">{formatAbility(poke.ability)}</span>
              </div>
            {/if}

            {#if poke.baseAbility && poke.baseAbility !== poke.ability}
              <div class="flex items-center gap-1.5 mb-1">
                <span class="text-white/40">Base:</span>
                <span class="text-cyan-300/60">{formatAbility(poke.baseAbility)}</span>
              </div>
            {/if}

            {#if poke.item}
              <div class="flex items-center gap-1.5 mb-1">
                <span class="text-white/40">Item:</span>
                <span class="text-yellow-300">{poke.item}</span>
              </div>
            {/if}

            {#if poke.teraType}
              <div class="flex items-center gap-1.5 mb-1">
                <span class="text-white/40">Tera:</span>
                <span class="text-purple-300">💎 {poke.teraType}</span>
              </div>
            {/if}

            {#if poke.moves?.length}
              <div class="mt-1.5 border-t border-white/5 pt-1.5">
                <span class="text-white/40 text-[10px] uppercase tracking-wider">Moves</span>
                <div class="mt-0.5 space-y-0.5">
                  {#each formatMoves(poke) as move}
                    <div class="text-white/80">• {move}</div>
                  {/each}
                </div>
              </div>
            {/if}

            {#if poke.stats}
              <div class="mt-1.5 border-t border-white/5 pt-1.5 grid grid-cols-3 gap-x-2 gap-y-0.5">
                {#each Object.entries(poke.stats) as [stat, val]}
                  <div class="text-[9px]">
                    <span class="text-white/30 uppercase">{stat}:</span>
                    <span class="text-white/70">{val}</span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .party-panel {
    background: linear-gradient(135deg, rgba(15, 25, 60, 0.9), rgba(10, 18, 40, 0.95));
    border: 1px solid rgba(255,255,255,0.06);
  }

  .party-slot {
    border: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.03);
  }

  .switchable-slot {
    cursor: pointer;
  }
  .switchable-slot:hover {
    background: rgba(255,255,255,0.08);
    border-color: rgba(59, 130, 246, 0.4);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  }

  .active-slot {
    background: rgba(59, 130, 246, 0.08);
    border-color: rgba(59, 130, 246, 0.3);
  }

  .fainted-slot {
    opacity: 0.45;
    cursor: not-allowed;
    background: rgba(239, 68, 68, 0.05);
  }

  .locked-slot {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .tooltip-card {
    animation: tooltipIn 0.15s ease-out both;
  }
  @keyframes tooltipIn {
    from { opacity: 0; transform: translateY(-90%); }
    to   { opacity: 1; transform: translateY(-100%); }
  }
</style>
