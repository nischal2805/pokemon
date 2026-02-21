<script lang="ts">
  import { user, isLoggedIn } from '$lib/stores/auth';
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { socket, onlineUsers } from '$lib/stores/socket';
  import { battleState, submitTeamPaste } from '$lib/stores/battle';
  import { preloadFromPaste } from '$lib/sprites';
  import { get } from 'svelte/store';

  let formatId = $state('gen9randombattle');
  let pendingChallenges = $state<{battleId: string; challenger: string; format: string}[]>([]);
  let statusMsg = $state('');

  // Team selection modal state
  let showTeamPicker = $state(false);
  let teamPickerAction = $state<'challenge' | 'accept'>('challenge');
  let teamPickerTarget = $state(''); // userId or battleId depending on action
  let savedTeams = $state<{id: string; name: string; format: string; paste: string}[]>([]);

  const FORMATS = [
    { id: 'gen9randombattle', name: 'Random Battle', random: true },
    { id: 'gen9ou', name: '[Gen 9] OU', random: false },
    { id: 'gen9ubers', name: '[Gen 9] Ubers', random: false },
    { id: 'gen9anythinggoes', name: '[Gen 9] Anything Goes', random: false },
    { id: 'gen9doublesou', name: '[Gen 9] Doubles OU', random: false },
    { id: 'gen9doublesubers', name: '[Gen 9] Doubles Ubers', random: false },
    { id: 'gen9randomdoublesbattle', name: 'Random Doubles', random: true },
    { id: 'gen7ou', name: '[Gen 7] OU (Megas)', random: false },
    { id: 'gen7randombattle', name: '[Gen 7] Random (Megas)', random: true },
  ];

  function isRandomFormat(id: string) {
    return FORMATS.find(f => f.id === id)?.random ?? false;
  }

  function loadSavedTeams() {
    try {
      const stored = localStorage.getItem('pokeserver-teams');
      savedTeams = stored ? JSON.parse(stored) : [];
    } catch { savedTeams = []; }
  }

  onMount(() => {
    if (!get(user)) { goto('/login'); return; }
    loadSavedTeams();
  });

  // Reactively set up lobby socket listeners when socket becomes available
  let lobbyCleanup: (() => void) | null = null;

  $effect(() => {
    const s = $socket;
    if (!s) return;

    const onChallenged = (data: any) => {
      pendingChallenges = [...pendingChallenges, data];
    };

    const onChallengeSent = (data: any) => {
      statusMsg = 'Challenge sent! Waiting for response...';
      setTimeout(() => statusMsg = '', 5000);
    };

    const onChallengeDeclined = (data: any) => {
      statusMsg = `${data.by} declined your challenge.`;
      setTimeout(() => statusMsg = '', 5000);
    };

    const onBattleStart = (data: any) => {
      goto(`/battle/${data.battleId}`);
    };

    const onError = (data: any) => {
      statusMsg = `Error: ${data.message}`;
      setTimeout(() => statusMsg = '', 5000);
    };

    s.on('challenged', onChallenged);
    s.on('challengeSent', onChallengeSent);
    s.on('challengeDeclined', onChallengeDeclined);
    s.on('battleStart', onBattleStart);
    s.on('error', onError);

    // Cleanup when socket changes or component unmounts
    return () => {
      s.off('challenged', onChallenged);
      s.off('challengeSent', onChallengeSent);
      s.off('challengeDeclined', onChallengeDeclined);
      s.off('battleStart', onBattleStart);
      s.off('error', onError);
    };
  });

  function challenge(targetId: string) {
    const fmt = FORMATS.find(f => f.id === formatId);
    if (fmt && !fmt.random) {
      // Need to pick a team first
      teamPickerAction = 'challenge';
      teamPickerTarget = targetId;
      loadSavedTeams();
      showTeamPicker = true;
      return;
    }
    const s = get(socket);
    if (s) s.emit('challenge', { targetUser: targetId, format: formatId });
  }

  function acceptChallenge(battleId: string) {
    const ch = pendingChallenges.find(c => c.battleId === battleId);
    const fmt = FORMATS.find(f => f.id === ch?.format);
    if (fmt && !fmt.random) {
      // Need to pick a team first, then accept
      teamPickerAction = 'accept';
      teamPickerTarget = battleId;
      if (ch) formatId = ch.format;
      loadSavedTeams();
      showTeamPicker = true;
      return;
    }
    const s = get(socket);
    if (s) s.emit('accept', { battleId });
    pendingChallenges = pendingChallenges.filter((c) => c.battleId !== battleId);
  }

  function confirmTeamPick(teamPaste: string) {
    const s = get(socket);
    if (!s) return;

    // Preload sprites for the team being submitted
    preloadFromPaste(teamPaste);

    if (teamPickerAction === 'challenge') {
      // Emit challenge with team included
      s.emit('challenge', { targetUser: teamPickerTarget, format: formatId, team: teamPaste });
    } else {
      // Accept + submit team
      s.emit('accept', { battleId: teamPickerTarget, team: teamPaste });
      pendingChallenges = pendingChallenges.filter((c) => c.battleId !== teamPickerTarget);
    }
    showTeamPicker = false;
  }

  function declineChallenge(battleId: string) {
    const s = get(socket);
    if (s) s.emit('decline', { battleId });
    pendingChallenges = pendingChallenges.filter((c) => c.battleId !== battleId);
  }
</script>

<div class="max-w-4xl mx-auto p-6">
  <h1 class="text-3xl font-bold mb-6">🏟️ Lobby</h1>

  {#if statusMsg}
    <div class="bg-[var(--bg-card)] text-[var(--accent)] px-4 py-2 rounded mb-4">{statusMsg}</div>
  {/if}

  <!-- Team Picker Modal -->
  {#if showTeamPicker}
    <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div class="bg-[var(--bg-secondary)] rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
        <h2 class="text-xl font-bold mb-4">Select Your Team</h2>
        <p class="text-sm text-[var(--text-muted)] mb-4">
          Pick a team for {FORMATS.find(f => f.id === formatId)?.name ?? formatId}
        </p>
        {#if savedTeams.filter(t => t.format === formatId).length === 0}
          <div class="text-center py-6">
            <p class="text-[var(--text-muted)] mb-2">No teams saved for this format.</p>
            <a href="/teams" class="text-[var(--accent)] underline text-sm">Go to Team Builder →</a>
          </div>
        {:else}
          <div class="space-y-2 mb-4">
            {#each savedTeams.filter(t => t.format === formatId) as team}
              <button
                onclick={() => confirmTeamPick(team.paste)}
                class="w-full text-left bg-[var(--bg-card)] hover:bg-[var(--bg-primary)] rounded-lg p-3 transition-colors"
              >
                <div class="font-semibold">{team.name}</div>
                <div class="text-xs text-[var(--text-muted)]">{team.format}</div>
              </button>
            {/each}
          </div>
        {/if}
        <button onclick={() => showTeamPicker = false}
          class="w-full bg-[var(--bg-card)] py-2 rounded text-sm mt-2">Cancel</button>
      </div>
    </div>
  {/if}

  <!-- Pending Challenges -->
  {#if pendingChallenges.length > 0}
    <div class="mb-6">
      <h2 class="text-lg font-semibold mb-2">Incoming Challenges</h2>
      {#each pendingChallenges as ch}
        <div class="bg-[var(--bg-card)] rounded-lg p-4 flex items-center justify-between mb-2">
          <span><strong>{ch.challenger}</strong> wants to battle ({ch.format})</span>
          <div class="flex gap-2">
            <button onclick={() => acceptChallenge(ch.battleId)}
              class="bg-green-600 hover:bg-green-500 px-4 py-1 rounded text-sm font-medium transition-colors">Accept</button>
            <button onclick={() => declineChallenge(ch.battleId)}
              class="bg-red-600 hover:bg-red-500 px-4 py-1 rounded text-sm font-medium transition-colors">Decline</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
    <!-- Format Selector -->
    <div class="md:col-span-1">
      <h2 class="text-lg font-semibold mb-3">Format</h2>
      <div class="space-y-1">
        {#each FORMATS as f}
          <button
            onclick={() => formatId = f.id}
            class="w-full text-left px-3 py-2 rounded text-sm transition-colors {formatId === f.id ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-card)]'}"
          >
            {f.name}
            {#if f.random}<span class="text-xs opacity-60 ml-1">🎲</span>{/if}
          </button>
        {/each}
      </div>
    </div>

    <!-- Online Users -->
    <div class="md:col-span-2">
      <h2 class="text-lg font-semibold mb-3">Online Players</h2>
      {#if $onlineUsers.length === 0}
        <p class="text-[var(--text-muted)]">No one else is online.</p>
      {:else}
        <div class="space-y-2">
          {#each $onlineUsers.filter(u => u.id !== $user?.id) as online}
            <div class="bg-[var(--bg-secondary)] rounded-lg p-3 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-green-400">●</span>
                <span class="font-medium">{online.username}</span>
              </div>
              <button onclick={() => challenge(online.id)}
                class="bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-4 py-1 rounded text-sm font-medium transition-colors">
                Challenge
              </button>
            </div>
          {:else}
            <p class="text-[var(--text-muted)]">You're the only one here.</p>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>
