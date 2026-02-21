<script lang="ts">
  import { onMount } from 'svelte';
  import { apiFetch, user } from '$lib/stores/auth';
  import { goto } from '$app/navigation';
  import { get } from 'svelte/store';

  let replays = $state<any[]>([]);
  let loading = $state(true);

  onMount(async () => {
    if (!get(user)) { goto('/login'); return; }
    try {
      const res = await apiFetch('/api/replays');
      if (res.ok) replays = await res.json();
    } catch {}
    loading = false;
  });
</script>

<div class="max-w-3xl mx-auto p-6">
  <h1 class="text-3xl font-bold mb-6">🎬 Replays</h1>

  {#if loading}
    <p class="text-[var(--text-muted)]">Loading...</p>
  {:else if replays.length === 0}
    <div class="text-center py-12 text-[var(--text-muted)]">
      <p class="text-lg mb-2">No replays yet</p>
      <p class="text-sm">Play some battles to see replays here!</p>
    </div>
  {:else}
    <div class="space-y-3">
      {#each replays as replay}
        <a href="/replays/{replay.battleId}"
          class="block bg-[var(--bg-secondary)] rounded-lg p-4 hover:bg-[var(--bg-card)] transition-colors">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-semibold">
                {replay.players?.map((p: any) => p.username).join(' vs ') ?? 'Unknown'}
              </h3>
              <p class="text-sm text-[var(--text-muted)]">
                {replay.format} · {new Date(replay.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div class="text-sm">
              {#if replay.winnerId}
                <span class="text-green-400">Winner: {replay.players?.find((p: any) => p.username)?.username ?? '?'}</span>
              {:else}
                <span class="text-[var(--text-muted)]">Tie</span>
              {/if}
            </div>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>
