<script lang="ts">
  interface Props {
    request: any;
    onsubmit: (order: string) => void;
  }
  let { request, onsubmit }: Props = $props();

  let pokemon = $derived(request?.side?.pokemon ?? []);

  // For team preview, we just select ordering (in most formats it's lead selection)
  // For simplicity, let user pick their lead — the rest follow in order
  let selectedLead = $state(0);

  function parseName(ident: string): string {
    if (!ident) return '???';
    const parts = ident.split(': ');
    return parts.length > 1 ? parts[1] : ident;
  }

  function submit() {
    // Build team order: selected lead first, then rest in original order
    const order = [];
    order.push(selectedLead + 1);
    for (let i = 0; i < pokemon.length; i++) {
      if (i !== selectedLead) order.push(i + 1);
    }
    onsubmit(order.join(''));
  }
</script>

<div class="bg-[var(--bg-secondary)] rounded-xl p-4">
  <h3 class="text-sm font-semibold text-[var(--text-muted)] mb-1">Team Preview</h3>
  <p class="text-xs text-[var(--text-muted)] mb-4">Choose your lead Pokémon:</p>

  <div class="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
    {#each pokemon as poke, i}
      <button
        onclick={() => selectedLead = i}
        class="rounded-lg p-3 text-left transition-all
          {selectedLead === i ? 'ring-2 ring-[var(--accent)] bg-[var(--accent)]/10' : 'bg-[var(--bg-card)] hover:bg-[var(--bg-primary)]'}"
      >
        <div class="font-semibold text-sm">{parseName(poke.ident)}</div>
        <div class="text-xs text-[var(--text-muted)]">
          {poke.details?.split(',').slice(0, 2).join(', ') ?? ''}
        </div>
        {#if selectedLead === i}
          <div class="text-xs text-[var(--accent)] mt-1">★ Lead</div>
        {/if}
      </button>
    {/each}
  </div>

  <button onclick={submit}
    class="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] py-2 rounded font-medium text-sm transition-colors">
    Start Battle!
  </button>
</div>
