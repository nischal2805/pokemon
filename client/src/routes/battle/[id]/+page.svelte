<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { user } from '$lib/stores/auth';
  import { battleState, sendMove, sendSwitch, sendTeam, sendForfeit } from '$lib/stores/battle';
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
      <p class="text-xl text-[var(--text-muted)]">Waiting for battle data...</p>
    </div>
  {:else}
    <!-- Battle Header -->
    <div class="flex items-center justify-between mb-4">
      <div class="text-sm text-[var(--text-muted)]">
        <span class="font-medium text-[var(--text-primary)]">{$battleState.format}</span>
        <span class="mx-2">—</span>
        Turn {$battleState.turn}
      </div>
      <div class="flex gap-2">
        {#if !$battleState.ended}
          {#if showForfeitConfirm}
            <span class="text-sm text-[var(--text-muted)] mr-2">Are you sure?</span>
            <button onclick={handleForfeit}
              class="bg-red-600 hover:bg-red-500 px-3 py-1 rounded text-sm font-medium transition-colors">Yes, Forfeit</button>
            <button onclick={() => showForfeitConfirm = false}
              class="bg-[var(--bg-card)] px-3 py-1 rounded text-sm transition-colors">Cancel</button>
          {:else}
            <button onclick={() => showForfeitConfirm = true}
              class="bg-red-900/50 hover:bg-red-800/50 text-red-300 px-3 py-1 rounded text-sm transition-colors">🏳️ Forfeit</button>
          {/if}
        {:else}
          <button onclick={goToLobby}
            class="bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-4 py-1 rounded text-sm font-medium transition-colors">Back to Lobby</button>
        {/if}
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- Main Battle Area -->
      <div class="lg:col-span-2 space-y-4">
        <BattleField state={$battleState} />

        {#if $battleState.ended}
          <div class="bg-[var(--bg-card)] rounded-xl p-6 text-center">
            <h2 class="text-2xl font-bold mb-2">
              {#if $battleState.winner === $user?.username}
                🎉 You Won!
              {:else if $battleState.winner === 'tie'}
                🤝 It's a Tie!
              {:else}
                💀 You Lost
              {/if}
            </h2>
            <p class="text-[var(--text-muted)]">
              {$battleState.winner && $battleState.winner !== 'tie' ? `Winner: ${$battleState.winner}` : 'The battle ended in a tie.'}
            </p>
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
          <div class="bg-[var(--bg-card)] rounded-xl p-4 text-center text-[var(--text-muted)]">
            ⏳ Waiting for opponent...
          </div>
        {/if}
      </div>

      <!-- Battle Log -->
      <div class="lg:col-span-1">
        <BattleLog logs={$battleState.log} />
      </div>
    </div>
  {/if}
</div>
