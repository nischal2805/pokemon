<script lang="ts">
  import '../app.css';
  import { onMount, onDestroy } from 'svelte';
  import { fetchMe, user, logout, isLoggedIn } from '$lib/stores/auth';
  import { connectSocket, disconnectSocket, connected, socket } from '$lib/stores/socket';
  import { initBattleListeners } from '$lib/stores/battle';
  import { goto } from '$app/navigation';

  let { children } = $props();
  let battleCleanup: (() => void) | null = null;

  onMount(async () => {
    await fetchMe();
    if ($user) {
      connectSocket();
    }
  });

  // Reactively set up battle listeners whenever the socket becomes available
  $effect(() => {
    const s = $socket;
    if (s) {
      // Clean up old listeners if any
      if (battleCleanup) battleCleanup();
      battleCleanup = initBattleListeners();
    }
  });

  onDestroy(() => {
    if (battleCleanup) battleCleanup();
  });

  async function handleLogout() {
    if (battleCleanup) { battleCleanup(); battleCleanup = null; }
    await logout();
    disconnectSocket();
    goto('/login');
  }
</script>

{#if $isLoggedIn}
  <nav class="bg-[var(--bg-secondary)] border-b border-[var(--bg-card)] px-6 py-3 flex items-center justify-between">
    <a href="/" class="flex items-center gap-2 text-xl font-bold text-[var(--accent)]">
      <img src="/masterball.png" alt="Master Ball" class="w-7 h-7 object-contain" style="image-rendering: pixelated;" />
      PokeServer
    </a>
    <div class="flex items-center gap-4">
      <a href="/" class="hover:text-[var(--accent)] transition-colors">Lobby</a>
      <a href="/leaderboard" class="hover:text-[var(--accent)] transition-colors">Leaderboard</a>
      <a href="/teams" class="hover:text-[var(--accent)] transition-colors">Teams</a>
      <a href="/replays" class="hover:text-[var(--accent)] transition-colors">Replays</a>
      <span class="text-[var(--text-muted)] text-sm">
        {$user?.username}
        {#if $connected}
          <span class="text-green-400">●</span>
        {:else}
          <span class="text-red-400">●</span>
        {/if}
      </span>
      <button onclick={handleLogout} class="text-sm text-[var(--text-muted)] hover:text-[var(--accent)]">Logout</button>
    </div>
  </nav>
{/if}

<main class="min-h-[calc(100vh-52px)]">
  {@render children()}
</main>
