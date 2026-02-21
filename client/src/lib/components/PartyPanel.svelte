<script lang="ts">
  import HPBar from './HPBar.svelte';

  interface Props {
    request: any;
    forceSwitch: boolean;
    onswitch: (slot: number) => void;
  }
  let { request, forceSwitch, onswitch }: Props = $props();

  let pokemon = $derived(request?.side?.pokemon ?? []);
  let trapped = $derived(!forceSwitch && (request?.active?.[0]?.trapped || request?.active?.[0]?.maybeTrapped));

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

  function canSwitch(poke: any, idx: number): boolean {
    // Active pokemon can't switch to itself
    if (poke.active && !forceSwitch) return false;
    // Fainted pokemon can't be switched to (unless it's forceSwitch and we're picking a replacement)
    if (isFainted(poke.condition)) return false;
    // Trapped
    if (trapped) return false;
    return true;
  }
</script>

<div class="bg-[var(--bg-secondary)] rounded-xl p-4">
  <h3 class="text-sm font-semibold text-[var(--text-muted)] mb-3">
    {forceSwitch ? '⚠️ Choose a Pokémon to send in!' : 'Party'}
  </h3>

  {#if trapped && !forceSwitch}
    <p class="text-xs text-red-400 mb-2">You are trapped and cannot switch!</p>
  {/if}

  <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
    {#each pokemon as poke, i}
      {@const fainted = isFainted(poke.condition)}
      {@const switchable = canSwitch(poke, i)}
      <button
        onclick={() => switchable && onswitch(i + 1)}
        disabled={!switchable}
        class="rounded-lg p-3 text-left transition-all
          {poke.active && !forceSwitch ? 'ring-2 ring-[var(--accent)] bg-[var(--accent)]/10' : ''}
          {fainted ? 'opacity-40 bg-red-900/20' : switchable ? 'bg-[var(--bg-card)] hover:bg-[var(--bg-primary)] cursor-pointer' : 'bg-[var(--bg-card)] opacity-60 cursor-not-allowed'}"
      >
        <div class="font-semibold text-sm truncate">
          {parseName(poke.ident)}
          {#if poke.active}<span class="text-xs text-[var(--accent)]"> (active)</span>{/if}
        </div>
        {#if !fainted}
          <HPBar percent={getHPPercent(poke.condition)} />
          <div class="text-xs text-[var(--text-muted)] mt-1">{poke.condition?.split(' ')[0] ?? ''}</div>
        {:else}
          <div class="text-xs text-red-400 mt-1">Fainted</div>
        {/if}
      </button>
    {/each}
  </div>
</div>
