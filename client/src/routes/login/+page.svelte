<script lang="ts">
  import { login, register, user } from '$lib/stores/auth';
  import { connectSocket } from '$lib/stores/socket';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';

  let mode = $state<'login' | 'register'>('login');
  let username = $state('');
  let password = $state('');
  let inviteCode = $state('');
  let error = $state('');
  let loading = $state(false);

  onMount(() => {
    if (get(user)) goto('/');
  });

  async function handleSubmit() {
    error = '';
    loading = true;
    try {
      if (mode === 'login') {
        await login(username, password);
      } else {
        await register(username, password, inviteCode);
      }
      connectSocket();
      goto('/');
    } catch (e: any) {
      error = e.message || 'Something went wrong';
    } finally {
      loading = false;
    }
  }
</script>

<div class="min-h-[80vh] flex items-center justify-center">
  <div class="bg-[var(--bg-secondary)] rounded-xl p-8 w-full max-w-md shadow-2xl">
    <div class="text-center mb-6">
      <h1 class="text-3xl font-bold">⚔️ PokeServer</h1>
      <p class="text-[var(--text-muted)] text-sm mt-1">Private Pokémon Battle Platform</p>
    </div>

    <div class="flex gap-2 mb-6">
      <button
        onclick={() => mode = 'login'}
        class="flex-1 py-2 rounded text-sm font-medium transition-colors {mode === 'login' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-card)] text-[var(--text-muted)]'}"
      >Login</button>
      <button
        onclick={() => mode = 'register'}
        class="flex-1 py-2 rounded text-sm font-medium transition-colors {mode === 'register' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-card)] text-[var(--text-muted)]'}"
      >Register</button>
    </div>

    {#if error}
      <div class="bg-red-900/50 text-red-300 px-3 py-2 rounded text-sm mb-4">{error}</div>
    {/if}

    <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
      <div class="space-y-4">
        <div>
          <label for="username" class="block text-sm font-medium mb-1">Username</label>
          <input
            id="username"
            type="text"
            bind:value={username}
            required
            minlength={3}
            maxlength={20}
            class="w-full px-3 py-2 rounded bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none transition-colors"
            placeholder="Enter username"
          />
        </div>

        <div>
          <label for="password" class="block text-sm font-medium mb-1">Password</label>
          <input
            id="password"
            type="password"
            bind:value={password}
            required
            minlength={6}
            class="w-full px-3 py-2 rounded bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none transition-colors"
            placeholder="Enter password"
          />
        </div>

        {#if mode === 'register'}
          <div>
            <label for="invite" class="block text-sm font-medium mb-1">Invite Code <span class="text-[var(--text-muted)]">(if required)</span></label>
            <input
              id="invite"
              type="text"
              bind:value={inviteCode}
              class="w-full px-3 py-2 rounded bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none transition-colors"
              placeholder="Invite code"
            />
          </div>
        {/if}

        <button
          type="submit"
          disabled={loading}
          class="w-full py-2 rounded font-medium transition-colors bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {loading ? '...' : mode === 'login' ? 'Log In' : 'Create Account'}
        </button>
      </div>
    </form>
  </div>
</div>
