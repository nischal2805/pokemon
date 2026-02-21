<script lang="ts">
  import { onMount } from 'svelte';

  interface Team {
    id: string;
    name: string;
    format: string;
    paste: string;
    pokemonCount: number;
    createdAt: string;
  }

  let teams = $state<Team[]>([]);
  let editing = $state<Team | null>(null);
  let showNew = $state(false);

  // New team form
  let newName = $state('');
  let newFormat = $state('gen9ou');
  let newPaste = $state('');
  let error = $state('');

  const FORMATS = [
    { id: 'gen9ou', name: '[Gen 9] OU' },
    { id: 'gen9ubers', name: '[Gen 9] Ubers' },
    { id: 'gen9anythinggoes', name: '[Gen 9] AG' },
    { id: 'gen9doublesou', name: '[Gen 9] Doubles OU' },
    { id: 'gen7ou', name: '[Gen 7] OU' },
  ];

  onMount(() => {
    loadTeams();
  });

  function loadTeams() {
    const stored = localStorage.getItem('pokeserver-teams');
    if (stored) {
      try { teams = JSON.parse(stored); } catch { teams = []; }
    }
  }

  function saveTeams() {
    localStorage.setItem('pokeserver-teams', JSON.stringify(teams));
  }

  function countPokemon(paste: string): number {
    // Count lines that look like Pokemon names (no leading whitespace, not empty, not a stat/move/etc)
    const lines = paste.trim().split('\n');
    let count = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '') {
        // Next non-empty line should be a Pokemon
        if (i + 1 < lines.length && lines[i + 1].trim()) count++;
      }
    }
    // First line is always a Pokemon if paste is non-empty
    if (lines[0]?.trim()) count++;
    return Math.min(count, 6);
  }

  function addTeam() {
    error = '';
    if (!newName.trim()) { error = 'Team name is required'; return; }
    if (!newPaste.trim()) { error = 'Team paste is required'; return; }

    const pokemon = countPokemon(newPaste);
    if (pokemon === 0) { error = 'Could not parse any Pokemon from paste'; return; }

    const team: Team = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      format: newFormat,
      paste: newPaste.trim(),
      pokemonCount: pokemon,
      createdAt: new Date().toISOString(),
    };

    teams = [...teams, team];
    saveTeams();
    showNew = false;
    newName = '';
    newPaste = '';
  }

  function deleteTeam(id: string) {
    teams = teams.filter(t => t.id !== id);
    saveTeams();
  }

  function startEdit(team: Team) {
    editing = { ...team };
  }

  function saveEdit() {
    if (!editing) return;
    editing.pokemonCount = countPokemon(editing.paste);
    teams = teams.map(t => t.id === editing!.id ? { ...editing! } : t);
    saveTeams();
    editing = null;
  }

  function exportTeam(team: Team) {
    navigator.clipboard.writeText(team.paste);
  }
</script>

<div class="max-w-4xl mx-auto p-6">
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-3xl font-bold">📋 Team Builder</h1>
    <button onclick={() => showNew = !showNew}
      class="bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-4 py-2 rounded font-medium text-sm transition-colors">
      {showNew ? 'Cancel' : '+ New Team'}
    </button>
  </div>

  <p class="text-[var(--text-muted)] text-sm mb-6">
    Import teams using <a href="https://pokemonshowdown.com/teambuilder" target="_blank" class="text-[var(--accent)] underline">Pokémon Showdown</a> paste format.
    Teams are stored locally in your browser.
  </p>

  <!-- New Team Form -->
  {#if showNew}
    <div class="bg-[var(--bg-secondary)] rounded-xl p-6 mb-6">
      <h2 class="text-lg font-semibold mb-4">Import Team</h2>

      {#if error}
        <div class="bg-red-900/50 text-red-300 px-3 py-2 rounded text-sm mb-4">{error}</div>
      {/if}

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label class="block text-sm font-medium mb-1">Team Name</label>
          <input type="text" bind:value={newName}
            class="w-full px-3 py-2 rounded bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none"
            placeholder="My OU Team" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Format</label>
          <select bind:value={newFormat}
            class="w-full px-3 py-2 rounded bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none">
            {#each FORMATS as f}
              <option value={f.id}>{f.name}</option>
            {/each}
          </select>
        </div>
      </div>

      <div class="mb-4">
        <label class="block text-sm font-medium mb-1">Showdown Paste</label>
        <textarea bind:value={newPaste} rows={12}
          class="w-full px-3 py-2 rounded bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none font-mono text-sm resize-y"
          placeholder="Dragapult @ Choice Specs
Ability: Infiltrator
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Shadow Ball
- Draco Meteor
- Flamethrower
- U-turn

..."></textarea>
      </div>

      <button onclick={addTeam}
        class="bg-green-600 hover:bg-green-500 px-6 py-2 rounded font-medium text-sm transition-colors">
        Save Team
      </button>
    </div>
  {/if}

  <!-- Editing overlay -->
  {#if editing}
    <div class="bg-[var(--bg-secondary)] rounded-xl p-6 mb-6 border border-[var(--accent)]">
      <h2 class="text-lg font-semibold mb-4">Edit: {editing.name}</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label class="block text-sm font-medium mb-1">Team Name</label>
          <input type="text" bind:value={editing.name}
            class="w-full px-3 py-2 rounded bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Format</label>
          <select bind:value={editing.format}
            class="w-full px-3 py-2 rounded bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none">
            {#each FORMATS as f}
              <option value={f.id}>{f.name}</option>
            {/each}
          </select>
        </div>
      </div>
      <div class="mb-4">
        <label class="block text-sm font-medium mb-1">Showdown Paste</label>
        <textarea bind:value={editing.paste} rows={12}
          class="w-full px-3 py-2 rounded bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none font-mono text-sm resize-y"></textarea>
      </div>
      <div class="flex gap-2">
        <button onclick={saveEdit}
          class="bg-green-600 hover:bg-green-500 px-6 py-2 rounded font-medium text-sm transition-colors">Save</button>
        <button onclick={() => editing = null}
          class="bg-[var(--bg-card)] px-6 py-2 rounded text-sm transition-colors">Cancel</button>
      </div>
    </div>
  {/if}

  <!-- Team List -->
  {#if teams.length === 0 && !showNew}
    <div class="text-center py-12 text-[var(--text-muted)]">
      <p class="text-lg mb-2">No teams yet</p>
      <p class="text-sm">Click "+ New Team" to import a Showdown paste.</p>
    </div>
  {:else}
    <div class="space-y-3">
      {#each teams as team}
        <div class="bg-[var(--bg-secondary)] rounded-lg p-4 flex items-center justify-between">
          <div>
            <h3 class="font-semibold">{team.name}</h3>
            <p class="text-sm text-[var(--text-muted)]">
              {FORMATS.find(f => f.id === team.format)?.name ?? team.format}
              · {team.pokemonCount} Pokémon
            </p>
          </div>
          <div class="flex gap-2">
            <button onclick={() => exportTeam(team)}
              class="bg-[var(--bg-card)] hover:bg-[var(--bg-primary)] px-3 py-1 rounded text-sm transition-colors" title="Copy paste to clipboard">📋</button>
            <button onclick={() => startEdit(team)}
              class="bg-[var(--bg-card)] hover:bg-[var(--bg-primary)] px-3 py-1 rounded text-sm transition-colors">✏️</button>
            <button onclick={() => deleteTeam(team.id)}
              class="bg-red-900/30 hover:bg-red-800/30 text-red-300 px-3 py-1 rounded text-sm transition-colors">🗑️</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
