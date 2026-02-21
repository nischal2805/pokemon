<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { user } from '$lib/stores/auth';
  import { battleState, sendMove, sendSwitch, sendTeam, sendForfeit } from '$lib/stores/battle';
  import { isAnimating, resetAnimQueue } from '$lib/stores/animQueue';
  import BattleField from '$lib/components/BattleField.svelte';
  import MovePanel from '$lib/components/MovePanel.svelte';
  import PartyPanel from '$lib/components/PartyPanel.svelte';
  import BattleLog from '$lib/components/BattleLog.svelte';
  import TeamSelect from '$lib/components/TeamSelect.svelte';

  let battleId = $derived($page.params.id!);  // always defined via [id] route param
  let showForfeitConfirm = $state(false);

  onMount(() => {
    if (!$user) { goto('/login'); return; }
    // Battle listeners are already initialized in the layout
  });

  function handleForfeit() {
    sendForfeit(battleId);
    showForfeitConfirm = false;
  }

  function goToLobby() {
    resetAnimQueue();
    battleState.set(null);
    goto('/');
  }

  // Determine what UI to show based on battle state
  let needsTeam = $derived(
    $battleState?.request &&
    !$battleState.ended &&
    $battleState.request.teamPreview &&
    !$battleState.teamSubmitted
  );

  let canAct = $derived(
    $battleState?.request &&
    !$battleState.ended &&
    !$battleState.waiting &&
    !needsTeam
  );

  let hasForceSwitch = $derived(
    $battleState?.request?.forceSwitch?.some((v: boolean) => v) ?? false
  );
</script>

<div class="max-w-6xl mx-auto p-4">
  {#if !$battleState}
    <div class="text-center py-20">
      <div class="inline-block animate-pulse">
        <div class="text-6xl mb-4">⚔️</div>
        <p class="text-lg text-[var(--text-muted)] font-medium">Connecting to battle...</p>
        <div class="mt-4 flex justify-center gap-1">
          <div class="w-2 h-2 bg-[var(--accent)] rounded-full animate-bounce" style="animation-delay: 0ms;"></div>
          <div class="w-2 h-2 bg-[var(--accent)] rounded-full animate-bounce" style="animation-delay: 150ms;"></div>
          <div class="w-2 h-2 bg-[var(--accent)] rounded-full animate-bounce" style="animation-delay: 300ms;"></div>
        </div>
      </div>
    </div>
  {:else}
    <!-- Battle Header -->
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-3">
        <span class="text-lg">⚔️</span>
        <div>
          <span class="font-bold text-sm text-white">{$battleState.format}</span>
          <span class="text-[var(--text-muted)] text-xs ml-2">Turn {$battleState.turn}</span>
        </div>
      </div>
      <div class="flex gap-2">
        {#if !$battleState.ended}
          {#if showForfeitConfirm}
            <span class="text-sm text-[var(--text-muted)] mr-2 self-center">Are you sure?</span>
            <button onclick={handleForfeit}
              class="bg-red-600 hover:bg-red-500 px-4 py-1.5 rounded-lg text-sm font-bold transition-all active:scale-95">
              Yes, Forfeit
            </button>
            <button onclick={() => showForfeitConfirm = false}
              class="bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)] px-4 py-1.5 rounded-lg text-sm transition-all">
              Cancel
            </button>
          {:else}
            <button onclick={() => showForfeitConfirm = true}
              class="bg-red-950/50 hover:bg-red-900/50 text-red-300 px-4 py-1.5 rounded-lg text-sm font-medium transition-all
                border border-red-800/30 hover:border-red-700/40">
              🏳️ Forfeit
            </button>
          {/if}
        {:else}
          <button onclick={goToLobby}
            class="bg-gradient-to-r from-[var(--accent)] to-pink-600 hover:from-[var(--accent-hover)] hover:to-pink-500
              px-5 py-1.5 rounded-lg text-sm font-bold transition-all active:scale-95
              shadow-lg shadow-[var(--accent)]/20">
            ← Back to Lobby
          </button>
        {/if}
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- Main Battle Area -->
      <div class="lg:col-span-2 space-y-4">
        <BattleField state={$battleState} />

        {#if $battleState.ended}
          <div class="result-banner rounded-2xl p-8 text-center">
            {#if $battleState.winner === $user?.username}
              <div class="text-5xl mb-3">🎉</div>
              <h2 class="text-3xl font-black text-green-400 mb-1">Victory!</h2>
              <p class="text-sm text-green-300/60">You won the battle!</p>
            {:else if $battleState.winner === 'tie'}
              <div class="text-5xl mb-3">🤝</div>
              <h2 class="text-3xl font-black text-yellow-400 mb-1">Tie!</h2>
              <p class="text-sm text-yellow-300/60">The battle ended in a draw.</p>
            {:else}
              <div class="text-5xl mb-3">💀</div>
              <h2 class="text-3xl font-black text-red-400 mb-1">Defeat</h2>
              <p class="text-sm text-red-300/60">Winner: {$battleState.winner}</p>
            {/if}
          </div>
        {:else if needsTeam}
          <TeamSelect
            request={$battleState.request}
            onsubmit={(order) => sendTeam(battleId, order)}
          />
        {:else if canAct}
          {#if hasForceSwitch}
            <PartyPanel
              request={$battleState.request}
              forceSwitch={true}
              onswitch={(slot) => sendSwitch(battleId, slot)}
            />
          {:else}
            <MovePanel
              request={$battleState.request}
              onmove={(moveSlot, mega, zmove, tera) => sendMove(battleId, moveSlot, mega, zmove, tera)}
            />
            <PartyPanel
              request={$battleState.request}
              forceSwitch={false}
              onswitch={(slot) => sendSwitch(battleId, slot)}
            />
          {/if}
        {:else if $battleState.waiting}
          <div class="waiting-panel rounded-2xl p-6 text-center">
            <div class="inline-flex items-center gap-3">
              <div class="flex gap-1">
                <div class="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style="animation-delay: 0ms;"></div>
                <div class="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style="animation-delay: 150ms;"></div>
                <div class="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style="animation-delay: 300ms;"></div>
              </div>
              <span class="text-sm text-blue-300/80 font-medium">Waiting for opponent...</span>
            </div>
          </div>
        {/if}
      </div>

      <!-- Battle Log -->
      <div class="lg:col-span-1">
        <BattleLog />
      </div>
    </div>
  {/if}
</div>

<style>
  .result-banner {
    background: linear-gradient(135deg, rgba(15, 25, 60, 0.9), rgba(10, 18, 40, 0.95));
    border: 1px solid rgba(255,255,255,0.06);
  }
  .waiting-panel {
    background: linear-gradient(135deg, rgba(15, 25, 60, 0.7), rgba(10, 18, 40, 0.8));
    border: 1px solid rgba(59, 130, 246, 0.15);
  }
</style>
