<script lang="ts">
  import { onMount } from 'svelte';
  import { apiFetch } from '$lib/stores/auth';

  let format = $state('gen9randombattle');
  let entries = $state<any[]>([]);
  let loading = $state(false);

  const FORMATS = [
    { id: 'gen9randombattle', name: 'Random Battle' },
    { id: 'gen9ou', name: '[Gen 9] OU' },
    { id: 'gen9ubers', name: 'Ubers' },
    { id: 'gen9anythinggoes', name: 'AG' },
    { id: 'gen7ou', name: '[Gen 7] OU' },
    { id: 'gen7randombattle', name: '[Gen 7] Random' },
  ];

  async function loadLeaderboard() {
    loading = true;
    try {
      const res = await apiFetch(`/api/leaderboard?format=${format}`);
      if (res.ok) entries = await res.json();
      else entries = [];
    } catch { entries = []; }
    loading = false;
  }

  onMount(() => loadLeaderboard());

  // Re-fetch when format changes
  let prevFormat = $state(format);
  $effect(() => {
    const currentFormat = format;
    if (currentFormat !== prevFormat) {
      prevFormat = currentFormat;
      loadLeaderboard();
    }
  });
</script>

<div class="max-w-3xl mx-auto p-6">
  <h1 class="text-3xl font-bold mb-6">🏆 Leaderboard</h1>

  <!-- Format Tabs -->
  <div class="flex flex-wrap gap-2 mb-6">
    {#each FORMATS as f}
      <button
        onclick={() => format = f.id}
        class="px-3 py-1 rounded text-sm transition-colors {format === f.id ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:bg-[var(--bg-card)]'}"
      >{f.name}</button>
    {/each}
  </div>

  {#if loading}
    <p class="text-[var(--text-muted)]">Loading...</p>
  {:else if entries.length === 0}
    <p class="text-[var(--text-muted)]">No ratings yet for this format.</p>
  {:else}
    <div class="bg-[var(--bg-secondary)] rounded-xl overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-[var(--border)]">
            <th class="text-left px-4 py-3 text-[var(--text-muted)] font-medium">#</th>
            <th class="text-left px-4 py-3 text-[var(--text-muted)] font-medium">Player</th>
            <th class="text-right px-4 py-3 text-[var(--text-muted)] font-medium">Rating</th>
            <th class="text-right px-4 py-3 text-[var(--text-muted)] font-medium">W</th>
            <th class="text-right px-4 py-3 text-[var(--text-muted)] font-medium">L</th>
            <th class="text-right px-4 py-3 text-[var(--text-muted)] font-medium">Win%</th>
          </tr>
        </thead>
        <tbody>
          {#each entries as entry, i}
            {@const total = entry.wins + entry.losses}
            {@const pct = total > 0 ? Math.round((entry.wins / total) * 100) : 0}
            <tr class="border-b border-[var(--border)]/30 hover:bg-[var(--bg-card)] transition-colors">
              <td class="px-4 py-3 font-medium">
                {#if i === 0}🥇{:else if i === 1}🥈{:else if i === 2}🥉{:else}{i + 1}{/if}
              </td>
              <td class="px-4 py-3 font-medium">{entry.username ?? 'Unknown'}</td>
              <td class="px-4 py-3 text-right font-mono font-bold text-[var(--accent)]">{entry.rating}</td>
              <td class="px-4 py-3 text-right text-green-400">{entry.wins}</td>
              <td class="px-4 py-3 text-right text-red-400">{entry.losses}</td>
              <td class="px-4 py-3 text-right text-[var(--text-muted)]">{pct}%</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
