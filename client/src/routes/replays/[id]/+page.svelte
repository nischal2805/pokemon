<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { apiFetch, user } from '$lib/stores/auth';
  import { goto } from '$app/navigation';
  import { get } from 'svelte/store';

  let replay = $state<any>(null);
  let loading = $state(true);
  let logLines = $state<string[]>([]);
  let visibleLines = $state(0);
  let playing = $state(false);
  let playInterval: ReturnType<typeof setInterval> | null = null;

  let replayId = $derived($page.params.id);

  onMount(async () => {
    if (!get(user)) { goto('/login'); return; }
    try {
      const res = await apiFetch(`/api/replays/${replayId}`);
      if (res.ok) {
        replay = await res.json();
        logLines = (replay.replayLog ?? '').split('\n').filter((l: string) => l.trim());
        visibleLines = logLines.length; // Show all by default
      }
    } catch {}
    loading = false;
  });

  function resetReplay() {
    visibleLines = 0;
    playing = false;
    if (playInterval) clearInterval(playInterval);
  }

  function playReplay() {
    if (playing) {
      playing = false;
      if (playInterval) clearInterval(playInterval);
      return;
    }
    if (visibleLines >= logLines.length) visibleLines = 0;
    playing = true;
    playInterval = setInterval(() => {
      if (visibleLines >= logLines.length) {
        playing = false;
        if (playInterval) clearInterval(playInterval);
        return;
      }
      visibleLines++;
    }, 100);
  }

  function showAll() {
    playing = false;
    if (playInterval) clearInterval(playInterval);
    visibleLines = logLines.length;
  }
</script>

<div class="max-w-4xl mx-auto p-6">
  <a href="/replays" class="text-[var(--accent)] text-sm mb-4 inline-block">← Back to Replays</a>

  {#if loading}
    <p class="text-[var(--text-muted)]">Loading replay...</p>
  {:else if !replay}
    <p class="text-red-400">Replay not found.</p>
  {:else}
    <h1 class="text-2xl font-bold mb-2">
      {replay.players?.map((p: any) => p.username).join(' vs ') ?? 'Battle'}
    </h1>
    <p class="text-[var(--text-muted)] text-sm mb-4">
      {replay.format} · {new Date(replay.createdAt).toLocaleDateString()}
      {#if replay.winnerId}· Winner: <span class="text-green-400">{replay.players?.find((p: any) => true)?.username ?? '?'}</span>{/if}
    </p>

    <!-- Playback Controls -->
    <div class="flex gap-2 mb-4">
      <button onclick={resetReplay}
        class="bg-[var(--bg-card)] px-3 py-1 rounded text-sm transition-colors hover:bg-[var(--bg-secondary)]">⏮ Reset</button>
      <button onclick={playReplay}
        class="bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-4 py-1 rounded text-sm font-medium transition-colors">
        {playing ? '⏸ Pause' : '▶ Play'}
      </button>
      <button onclick={showAll}
        class="bg-[var(--bg-card)] px-3 py-1 rounded text-sm transition-colors hover:bg-[var(--bg-secondary)]">⏭ Show All</button>
      <span class="text-sm text-[var(--text-muted)] self-center ml-2">
        {visibleLines} / {logLines.length} lines
      </span>
    </div>

    <!-- Log Display -->
    <div class="bg-[var(--bg-secondary)] rounded-xl p-4 font-mono text-sm max-h-[70vh] overflow-y-auto">
      {#each logLines.slice(0, visibleLines) as line}
        <div class="py-0.5 {line.startsWith('|win|') ? 'text-green-400 font-bold' : line.startsWith('|move|') ? 'text-blue-300' : line.startsWith('|-damage') ? 'text-red-300' : line.startsWith('|switch|') || line.startsWith('|drag|') ? 'text-yellow-300' : line.startsWith('|faint|') ? 'text-red-500 font-bold' : 'text-[var(--text-muted)]'}">
          {line}
        </div>
      {/each}
    </div>
  {/if}
</div>
