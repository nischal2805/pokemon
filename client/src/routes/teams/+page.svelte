<script lang="ts">
  import { onMount } from 'svelte';
  import { iconUrl, spriteUrl } from '$lib/sprites';
  import speciesData from '$lib/speciesData.json';
  import movesData from '$lib/moves.json';
  import abilitiesData from '$lib/abilities.json';
  import itemsData from '$lib/items.json';
  import naturesData from '$lib/natures.json';

  // ── Types ──
  interface Team {
    id: string;
    name: string;
    format: string;
    paste: string;
    pokemonCount: number;
    createdAt: string;
  }

  interface PokemonSet {
    species: string;
    nickname: string;
    item: string;
    ability: string;
    nature: string;
    moves: string[];
    evs: Record<string, number>;
    ivs: Record<string, number>;
    level: number;
    shiny: boolean;
    teraType: string;
  }

  interface SpeciesInfo {
    name: string;
    types: string[];
    baseStats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  }

  const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
  const STAT_NAMES: Record<string, string> = {
    hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe'
  };
  const TYPES = [
    'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison',
    'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy', 'Stellar'
  ];
  const FORMATS = [
    { id: 'gen9ou', name: '[Gen 9] OU' },
    { id: 'gen9ubers', name: '[Gen 9] Ubers' },
    { id: 'gen9anythinggoes', name: '[Gen 9] AG' },
    { id: 'gen9doublesou', name: '[Gen 9] Doubles OU' },
    { id: 'gen9doublesubers', name: '[Gen 9] Doubles Ubers' },
    { id: 'gen7ou', name: '[Gen 7] OU (Megas)' },
  ];

  const speciesList: SpeciesInfo[] = speciesData as SpeciesInfo[];
  const movesList: string[] = movesData as string[];
  const abilitiesList: string[] = abilitiesData as string[];
  const itemsList: string[] = itemsData as string[];
  const naturesList: { name: string; plus: string | null; minus: string | null }[] = naturesData as any;

  // ── State ──
  let teams = $state<Team[]>([]);
  let tab = $state<'list' | 'import' | 'builder'>('list');
  let editingId = $state<string | null>(null);
  let editingTeam = $state<Team | null>(null);

  // Import form
  let importName = $state('');
  let importFormat = $state('gen9ou');
  let importPaste = $state('');
  let importError = $state('');

  // Builder state
  let builderName = $state('');
  let builderFormat = $state('gen9ou');
  let builderSlots = $state<PokemonSet[]>([]);
  let activeSlot = $state(0);
  let builderError = $state('');

  // Search states for autocomplete
  let speciesQuery = $state('');
  let moveQueries = $state(['', '', '', '']);
  let abilityQuery = $state('');
  let itemQuery = $state('');
  let showSpeciesDropdown = $state(false);
  let showMoveDropdown = $state<number | null>(null);
  let showAbilityDropdown = $state(false);
  let showItemDropdown = $state(false);

  // ── Computed ──
  let currentMon = $derived(builderSlots[activeSlot]);

  let filteredSpecies = $derived(
    speciesQuery.length >= 1
      ? speciesList.filter(s => s.name.toLowerCase().includes(speciesQuery.toLowerCase())).slice(0, 20)
      : []
  );

  let filteredAbilities = $derived(
    abilityQuery.length >= 1
      ? abilitiesList.filter(a => a.toLowerCase().includes(abilityQuery.toLowerCase())).slice(0, 15)
      : []
  );

  let filteredItems = $derived(
    itemQuery.length >= 1
      ? itemsList.filter(i => i.toLowerCase().includes(itemQuery.toLowerCase())).slice(0, 15)
      : []
  );

  function filteredMoves(idx: number): string[] {
    const q = moveQueries[idx];
    if (!q || q.length < 1) return [];
    return movesList.filter(m => m.toLowerCase().includes(q.toLowerCase())).slice(0, 15);
  }

  // ── Lifecycle ──
  onMount(() => { loadTeams(); });

  function loadTeams() {
    const stored = localStorage.getItem('pokeserver-teams');
    if (stored) { try { teams = JSON.parse(stored); } catch { teams = []; } }
  }
  function saveTeams() { localStorage.setItem('pokeserver-teams', JSON.stringify(teams)); }

  // ── Import flow ──
  function countPokemon(paste: string): number {
    const lines = paste.trim().split('\n');
    let count = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '' && i + 1 < lines.length && lines[i + 1].trim()) count++;
    }
    if (lines[0]?.trim()) count++;
    return Math.min(count, 6);
  }

  function doImport() {
    importError = '';
    if (!importName.trim()) { importError = 'Team name is required'; return; }
    if (!importPaste.trim()) { importError = 'Paste is required'; return; }
    const pokemon = countPokemon(importPaste);
    if (pokemon === 0) { importError = 'Could not parse any Pokémon'; return; }
    const team: Team = {
      id: crypto.randomUUID(), name: importName.trim(), format: importFormat,
      paste: importPaste.trim(), pokemonCount: pokemon, createdAt: new Date().toISOString(),
    };
    teams = [...teams, team];
    saveTeams();
    importName = ''; importPaste = '';
    tab = 'list';
  }

  // ── Builder flow ──
  function emptySet(): PokemonSet {
    return {
      species: '', nickname: '', item: '', ability: '', nature: 'Adamant',
      moves: ['', '', '', ''],
      evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
      level: 100, shiny: false, teraType: '',
    };
  }

  function startBuilder() {
    builderName = '';
    builderFormat = 'gen9ou';
    builderSlots = [emptySet()];
    activeSlot = 0;
    editingId = null;
    builderError = '';
    speciesQuery = '';
    moveQueries = ['', '', '', ''];
    abilityQuery = '';
    itemQuery = '';
    tab = 'builder';
  }

  function editTeamBuilder(team: Team) {
    builderName = team.name;
    builderFormat = team.format;
    builderSlots = parsePaste(team.paste);
    if (builderSlots.length === 0) builderSlots = [emptySet()];
    activeSlot = 0;
    syncSearchFields(0);
    editingId = team.id;
    tab = 'builder';
  }

  function syncSearchFields(idx: number) {
    const mon = builderSlots[idx];
    if (!mon) return;
    speciesQuery = mon.species;
    abilityQuery = mon.ability;
    itemQuery = mon.item;
    moveQueries = [...mon.moves];
  }

  function addSlot() {
    if (builderSlots.length >= 6) return;
    builderSlots = [...builderSlots, emptySet()];
    activeSlot = builderSlots.length - 1;
    syncSearchFields(activeSlot);
  }

  function removeSlot(idx: number) {
    if (builderSlots.length <= 1) return;
    builderSlots = builderSlots.filter((_, i) => i !== idx);
    if (activeSlot >= builderSlots.length) activeSlot = builderSlots.length - 1;
    syncSearchFields(activeSlot);
  }

  function selectSlot(idx: number) {
    commitSearchFields();
    activeSlot = idx;
    syncSearchFields(idx);
  }

  function commitSearchFields() {
    if (!currentMon) return;
    const updated = [...builderSlots];
    updated[activeSlot] = { ...currentMon, moves: [...moveQueries] };
    builderSlots = updated;
  }

  function selectSpecies(s: SpeciesInfo) {
    const updated = [...builderSlots];
    updated[activeSlot] = { ...updated[activeSlot], species: s.name };
    builderSlots = updated;
    speciesQuery = s.name;
    showSpeciesDropdown = false;
  }

  function selectAbility(a: string) {
    const updated = [...builderSlots];
    updated[activeSlot] = { ...updated[activeSlot], ability: a };
    builderSlots = updated;
    abilityQuery = a;
    showAbilityDropdown = false;
  }

  function selectItem(i: string) {
    const updated = [...builderSlots];
    updated[activeSlot] = { ...updated[activeSlot], item: i };
    builderSlots = updated;
    itemQuery = i;
    showItemDropdown = false;
  }

  function selectMove(idx: number, m: string) {
    const newMoves = [...moveQueries];
    newMoves[idx] = m;
    moveQueries = newMoves;
    const updated = [...builderSlots];
    updated[activeSlot] = { ...updated[activeSlot], moves: [...newMoves] };
    builderSlots = updated;
    showMoveDropdown = null;
  }

  function setEv(stat: string, val: number) {
    const clamped = Math.max(0, Math.min(252, val));
    const updated = [...builderSlots];
    updated[activeSlot] = { ...updated[activeSlot], evs: { ...updated[activeSlot].evs, [stat]: clamped } };
    builderSlots = updated;
  }

  function setIv(stat: string, val: number) {
    const clamped = Math.max(0, Math.min(31, val));
    const updated = [...builderSlots];
    updated[activeSlot] = { ...updated[activeSlot], ivs: { ...updated[activeSlot].ivs, [stat]: clamped } };
    builderSlots = updated;
  }

  function setNature(n: string) {
    const updated = [...builderSlots];
    updated[activeSlot] = { ...updated[activeSlot], nature: n };
    builderSlots = updated;
  }

  function setTeraType(t: string) {
    const updated = [...builderSlots];
    updated[activeSlot] = { ...updated[activeSlot], teraType: t };
    builderSlots = updated;
  }

  function setLevel(l: number) {
    const updated = [...builderSlots];
    updated[activeSlot] = { ...updated[activeSlot], level: Math.max(1, Math.min(100, l)) };
    builderSlots = updated;
  }

  function toggleShiny() {
    const updated = [...builderSlots];
    updated[activeSlot] = { ...updated[activeSlot], shiny: !updated[activeSlot].shiny };
    builderSlots = updated;
  }

  function totalEvs(): number {
    if (!currentMon) return 0;
    return Object.values(currentMon.evs).reduce((a, b) => a + b, 0);
  }

  // ── Generate Showdown paste ──
  function toPaste(slots: PokemonSet[]): string {
    return slots.filter(s => s.species).map(s => {
      let line1 = s.species;
      if (s.nickname && s.nickname !== s.species) line1 = `${s.nickname} (${s.species})`;
      if (s.item) line1 += ` @ ${s.item}`;

      const lines = [line1];
      if (s.ability) lines.push(`Ability: ${s.ability}`);
      if (s.level !== 100) lines.push(`Level: ${s.level}`);
      if (s.shiny) lines.push(`Shiny: Yes`);
      if (s.teraType) lines.push(`Tera Type: ${s.teraType}`);

      const evParts = STAT_KEYS.filter(k => s.evs[k] > 0).map(k => `${s.evs[k]} ${STAT_NAMES[k]}`);
      if (evParts.length > 0) lines.push(`EVs: ${evParts.join(' / ')}`);

      lines.push(`${s.nature} Nature`);

      const ivParts = STAT_KEYS.filter(k => s.ivs[k] < 31).map(k => `${s.ivs[k]} ${STAT_NAMES[k]}`);
      if (ivParts.length > 0) lines.push(`IVs: ${ivParts.join(' / ')}`);

      s.moves.filter(m => m).forEach(m => lines.push(`- ${m}`));

      return lines.join('\n');
    }).join('\n\n');
  }

  function saveBuilder() {
    commitSearchFields();
    builderError = '';
    if (!builderName.trim()) { builderError = 'Team name is required'; return; }
    const validSlots = builderSlots.filter(s => s.species);
    if (validSlots.length === 0) { builderError = 'Add at least one Pokémon'; return; }
    const paste = toPaste(validSlots);

    if (editingId) {
      teams = teams.map(t => t.id === editingId ? {
        ...t, name: builderName.trim(), format: builderFormat,
        paste, pokemonCount: validSlots.length,
      } : t);
      editingId = null;
    } else {
      const team: Team = {
        id: crypto.randomUUID(), name: builderName.trim(), format: builderFormat,
        paste, pokemonCount: validSlots.length, createdAt: new Date().toISOString(),
      };
      teams = [...teams, team];
    }
    saveTeams();
    tab = 'list';
  }

  // ── Parse paste back to PokemonSets ──
  function parsePaste(paste: string): PokemonSet[] {
    const blocks = paste.trim().split(/\n\s*\n/);
    return blocks.map(block => {
      const set = emptySet();
      const lines = block.split('\n').map(l => l.trim());
      if (lines.length === 0) return set;

      let line1 = lines[0];
      const atIdx = line1.lastIndexOf(' @ ');
      if (atIdx !== -1) {
        set.item = line1.slice(atIdx + 3).trim();
        line1 = line1.slice(0, atIdx).trim();
      }
      const parenMatch = line1.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
      if (parenMatch) {
        set.nickname = parenMatch[1].trim();
        set.species = parenMatch[2].trim();
      } else {
        set.species = line1.trim();
      }

      let moveIdx = 0;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('Ability:')) set.ability = line.slice(8).trim();
        else if (line.startsWith('Level:')) set.level = parseInt(line.slice(6).trim()) || 100;
        else if (line.startsWith('Shiny:')) set.shiny = line.slice(6).trim().toLowerCase() === 'yes';
        else if (line.startsWith('Tera Type:')) set.teraType = line.slice(10).trim();
        else if (line.endsWith('Nature')) set.nature = line.replace(' Nature', '').trim();
        else if (line.startsWith('EVs:')) {
          line.slice(4).split('/').forEach(p => {
            const m = p.trim().match(/^(\d+)\s+(\w+)$/);
            if (m) {
              const key = Object.entries(STAT_NAMES).find(([, v]) => v === m[2])?.[0];
              if (key) set.evs[key] = parseInt(m[1]);
            }
          });
        } else if (line.startsWith('IVs:')) {
          line.slice(4).split('/').forEach(p => {
            const m = p.trim().match(/^(\d+)\s+(\w+)$/);
            if (m) {
              const key = Object.entries(STAT_NAMES).find(([, v]) => v === m[2])?.[0];
              if (key) set.ivs[key] = parseInt(m[1]);
            }
          });
        } else if (line.startsWith('- ') && moveIdx < 4) {
          set.moves[moveIdx] = line.slice(2).trim();
          moveIdx++;
        }
      }
      return set;
    }).filter(s => s.species);
  }

  // ── Team list helpers ──
  function deleteTeam(id: string) { teams = teams.filter(t => t.id !== id); saveTeams(); }
  function exportTeam(team: Team) { navigator.clipboard.writeText(team.paste); }

  function startPasteEdit(team: Team) { editingTeam = { ...team }; }
  function savePasteEdit() {
    if (!editingTeam) return;
    editingTeam.pokemonCount = countPokemon(editingTeam.paste);
    teams = teams.map(t => t.id === editingTeam!.id ? { ...editingTeam! } : t);
    saveTeams();
    editingTeam = null;
  }

  function evPreset(stat: string, val: number) { setEv(stat, val); }

  function natureDesc(n: { name: string; plus: string | null; minus: string | null }): string {
    if (!n.plus || !n.minus) return 'Neutral';
    return `+${STAT_NAMES[n.plus]} / -${STAT_NAMES[n.minus]}`;
  }

  function getSpeciesInfo(name: string): SpeciesInfo | undefined {
    return speciesList.find(s => s.name === name);
  }

  const TYPE_COLORS: Record<string, string> = {
    Normal: '#A8A878', Fire: '#F08030', Water: '#6890F0', Electric: '#F8D030',
    Grass: '#78C850', Ice: '#98D8D8', Fighting: '#C03028', Poison: '#A040A0',
    Ground: '#E0C068', Flying: '#A890F0', Psychic: '#F85888', Bug: '#A8B820',
    Rock: '#B8A038', Ghost: '#705898', Dragon: '#7038F8', Dark: '#705848',
    Steel: '#B8B8D0', Fairy: '#EE99AC', Stellar: '#44BBCC',
  };

  function closeDropdowns() {
    showSpeciesDropdown = false;
    showMoveDropdown = null;
    showAbilityDropdown = false;
    showItemDropdown = false;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<svelte:window onclick={closeDropdowns} />

<div class="max-w-5xl mx-auto p-6">
  <!-- Header -->
  <div class="flex items-center justify-between mb-4">
    <h1 class="text-3xl font-bold">📋 Team Builder</h1>
    <div class="flex gap-2">
      {#if tab !== 'list'}
        <button onclick={() => { tab = 'list'; editingId = null; }}
          class="bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)] px-4 py-2 rounded text-sm transition-colors">
          ← Back
        </button>
      {/if}
      {#if tab === 'list'}
        <button onclick={() => { tab = 'import'; importError = ''; }}
          class="bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)] px-4 py-2 rounded font-medium text-sm transition-colors">
          📄 Import Paste
        </button>
        <button onclick={startBuilder}
          class="bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-4 py-2 rounded font-medium text-sm transition-colors">
          ✨ New Team
        </button>
      {/if}
    </div>
  </div>

  {#if tab === 'list'}
    <p class="text-[var(--text-muted)] text-sm mb-6">
      Build teams visually or import from <a href="https://pokemonshowdown.com/teambuilder" target="_blank" class="text-[var(--accent)] underline">Pokémon Showdown</a> paste format. Stored locally in your browser.
    </p>
  {/if}

  <!-- ════════════════════════ IMPORT TAB ════════════════════════ -->
  {#if tab === 'import'}
    <div class="bg-[var(--bg-secondary)] rounded-xl p-6 mb-6">
      <h2 class="text-lg font-semibold mb-4">Import from Paste</h2>
      {#if importError}
        <div class="bg-red-900/50 text-red-300 px-3 py-2 rounded text-sm mb-4">{importError}</div>
      {/if}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label class="block text-sm font-medium mb-1">Team Name</label>
          <input type="text" bind:value={importName}
            class="w-full px-3 py-2 rounded bg-[var(--bg-card)] border border-[var(--border,#333)] focus:border-[var(--accent)] focus:outline-none"
            placeholder="My OU Team" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Format</label>
          <select bind:value={importFormat}
            class="w-full px-3 py-2 rounded bg-[var(--bg-card)] border border-[var(--border,#333)] focus:border-[var(--accent)] focus:outline-none">
            {#each FORMATS as f}
              <option value={f.id}>{f.name}</option>
            {/each}
          </select>
        </div>
      </div>
      <div class="mb-4">
        <label class="block text-sm font-medium mb-1">Showdown Paste</label>
        <textarea bind:value={importPaste} rows={12}
          class="w-full px-3 py-2 rounded bg-[var(--bg-card)] border border-[var(--border,#333)] focus:border-[var(--accent)] focus:outline-none font-mono text-sm resize-y"
          placeholder="Dragapult @ Choice Specs
Ability: Infiltrator
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Shadow Ball
- Draco Meteor
- Flamethrower
- U-turn"></textarea>
      </div>
      <button onclick={doImport}
        class="bg-green-600 hover:bg-green-500 px-6 py-2 rounded font-medium text-sm transition-colors">
        Save Team
      </button>
    </div>
  {/if}

  <!-- ════════════════════════ BUILDER TAB ════════════════════════ -->
  {#if tab === 'builder'}
    <div class="space-y-4">
      <!-- Team Meta -->
      <div class="bg-[var(--bg-secondary)] rounded-xl p-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-xs font-medium text-[var(--text-muted)] mb-1">Team Name</label>
            <input type="text" bind:value={builderName}
              class="w-full px-3 py-2 rounded bg-[var(--bg-card)] border border-[var(--border,#333)] focus:border-[var(--accent)] focus:outline-none text-sm"
              placeholder="My Team" />
          </div>
          <div>
            <label class="block text-xs font-medium text-[var(--text-muted)] mb-1">Format</label>
            <select bind:value={builderFormat}
              class="w-full px-3 py-2 rounded bg-[var(--bg-card)] border border-[var(--border,#333)] focus:border-[var(--accent)] focus:outline-none text-sm">
              {#each FORMATS as f}
                <option value={f.id}>{f.name}</option>
              {/each}
            </select>
          </div>
          <div class="flex items-end gap-2">
            <button onclick={saveBuilder}
              class="bg-green-600 hover:bg-green-500 px-6 py-2 rounded font-medium text-sm transition-colors flex-1">
              💾 Save Team
            </button>
          </div>
        </div>
        {#if builderError}
          <div class="bg-red-900/50 text-red-300 px-3 py-2 rounded text-sm mt-3">{builderError}</div>
        {/if}
      </div>

      <!-- Pokemon Slot Tabs -->
      <div class="flex gap-2 flex-wrap">
        {#each builderSlots as slot, idx}
          <button onclick={() => selectSlot(idx)}
            class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all {activeSlot === idx ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-card)]'}">
            {#if slot.species}
              <img src={iconUrl(slot.species)} alt="" class="w-8 h-8" style="image-rendering: pixelated;"
                onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <span class="font-medium">{slot.species}</span>
            {:else}
              <span class="text-[var(--text-muted)]">Slot {idx + 1}</span>
            {/if}
            {#if builderSlots.length > 1}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <span class="ml-1 text-xs opacity-50 hover:opacity-100 cursor-pointer"
                onclick={(e) => { e.stopPropagation(); removeSlot(idx); }}>✕</span>
            {/if}
          </button>
        {/each}
        {#if builderSlots.length < 6}
          <button onclick={addSlot}
            class="px-3 py-2 rounded-lg text-sm bg-[var(--bg-secondary)] hover:bg-[var(--bg-card)] text-[var(--text-muted)] transition-colors">
            + Add
          </button>
        {/if}
      </div>

      <!-- Active Slot Editor -->
      {#if currentMon}
        <div class="bg-[var(--bg-secondary)] rounded-xl p-5">
          <div class="grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-6">
            <!-- Left: Fields -->
            <div class="space-y-4">
              <!-- Species + Item row -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- Species -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="relative">
                  <label class="block text-xs font-medium text-[var(--text-muted)] mb-1">Species</label>
                  <input type="text" bind:value={speciesQuery}
                    onfocus={() => { showSpeciesDropdown = true; }}
                    onclick={(e) => { e.stopPropagation(); showSpeciesDropdown = true; }}
                    oninput={() => { showSpeciesDropdown = true; }}
                    class="w-full px-3 py-2 rounded bg-[var(--bg-card)] border border-[var(--border,#333)] focus:border-[var(--accent)] focus:outline-none text-sm"
                    placeholder="Search species..." />
                  {#if showSpeciesDropdown && filteredSpecies.length > 0}
                    <div class="absolute z-50 w-full mt-1 bg-[var(--bg-card)] border border-[var(--border,#333)] rounded-lg shadow-xl max-h-60 overflow-y-auto"
                      onclick={(e) => e.stopPropagation()}>
                      {#each filteredSpecies as s}
                        <button onclick={() => selectSpecies(s)}
                          class="w-full px-3 py-2 text-left text-sm hover:bg-[var(--bg-secondary)] flex items-center gap-2 transition-colors">
                          <img src={iconUrl(s.name)} alt="" class="w-6 h-6" style="image-rendering: pixelated;"
                            onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          <span>{s.name}</span>
                          <span class="ml-auto flex gap-1">
                            {#each s.types as t}
                              <span class="text-[10px] px-1.5 py-0.5 rounded font-medium" style="background: {TYPE_COLORS[t]}33; color: {TYPE_COLORS[t]}">{t}</span>
                            {/each}
                          </span>
                        </button>
                      {/each}
                    </div>
                  {/if}
                </div>

                <!-- Item -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="relative">
                  <label class="block text-xs font-medium text-[var(--text-muted)] mb-1">Item</label>
                  <input type="text" bind:value={itemQuery}
                    onfocus={() => { showItemDropdown = true; }}
                    onclick={(e) => { e.stopPropagation(); showItemDropdown = true; }}
                    oninput={() => { showItemDropdown = true; }}
                    class="w-full px-3 py-2 rounded bg-[var(--bg-card)] border border-[var(--border,#333)] focus:border-[var(--accent)] focus:outline-none text-sm"
                    placeholder="Search item..." />
                  {#if showItemDropdown && filteredItems.length > 0}
                    <div class="absolute z-50 w-full mt-1 bg-[var(--bg-card)] border border-[var(--border,#333)] rounded-lg shadow-xl max-h-60 overflow-y-auto"
                      onclick={(e) => e.stopPropagation()}>
                      {#each filteredItems as i}
                        <button onclick={() => selectItem(i)}
                          class="w-full px-3 py-2 text-left text-sm hover:bg-[var(--bg-secondary)] transition-colors">
                          {i}
                        </button>
                      {/each}
                    </div>
                  {/if}
                </div>
              </div>

              <!-- Ability + Nature -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- Ability -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="relative">
                  <label class="block text-xs font-medium text-[var(--text-muted)] mb-1">Ability</label>
                  <input type="text" bind:value={abilityQuery}
                    onfocus={() => { showAbilityDropdown = true; }}
                    onclick={(e) => { e.stopPropagation(); showAbilityDropdown = true; }}
                    oninput={() => { showAbilityDropdown = true; }}
                    class="w-full px-3 py-2 rounded bg-[var(--bg-card)] border border-[var(--border,#333)] focus:border-[var(--accent)] focus:outline-none text-sm"
                    placeholder="Search ability..." />
                  {#if showAbilityDropdown && filteredAbilities.length > 0}
                    <div class="absolute z-50 w-full mt-1 bg-[var(--bg-card)] border border-[var(--border,#333)] rounded-lg shadow-xl max-h-60 overflow-y-auto"
                      onclick={(e) => e.stopPropagation()}>
                      {#each filteredAbilities as a}
                        <button onclick={() => selectAbility(a)}
                          class="w-full px-3 py-2 text-left text-sm hover:bg-[var(--bg-secondary)] transition-colors">
                          {a}
                        </button>
                      {/each}
                    </div>
                  {/if}
                </div>

                <!-- Nature -->
                <div>
                  <label class="block text-xs font-medium text-[var(--text-muted)] mb-1">Nature</label>
                  <select value={currentMon.nature} onchange={(e) => setNature((e.target as HTMLSelectElement).value)}
                    class="w-full px-3 py-2 rounded bg-[var(--bg-card)] border border-[var(--border,#333)] focus:border-[var(--accent)] focus:outline-none text-sm">
                    {#each naturesList as n}
                      <option value={n.name}>{n.name} ({natureDesc(n)})</option>
                    {/each}
                  </select>
                </div>
              </div>

              <!-- Moves -->
              <div>
                <label class="block text-xs font-medium text-[var(--text-muted)] mb-1">Moves</label>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {#each [0, 1, 2, 3] as idx}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div class="relative">
                      <input type="text" bind:value={moveQueries[idx]}
                        onfocus={() => { showMoveDropdown = idx; }}
                        onclick={(e) => { e.stopPropagation(); showMoveDropdown = idx; }}
                        oninput={() => { showMoveDropdown = idx; }}
                        class="w-full px-3 py-2 rounded bg-[var(--bg-card)] border border-[var(--border,#333)] focus:border-[var(--accent)] focus:outline-none text-sm"
                        placeholder="Move {idx + 1}" />
                      {#if showMoveDropdown === idx && filteredMoves(idx).length > 0}
                        <div class="absolute z-50 w-full mt-1 bg-[var(--bg-card)] border border-[var(--border,#333)] rounded-lg shadow-xl max-h-48 overflow-y-auto"
                          onclick={(e) => e.stopPropagation()}>
                          {#each filteredMoves(idx) as m}
                            <button onclick={() => selectMove(idx, m)}
                              class="w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--bg-secondary)] transition-colors">
                              {m}
                            </button>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>

              <!-- EVs -->
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-xs font-medium text-[var(--text-muted)]">EVs</label>
                  <span class="text-xs {totalEvs() > 510 ? 'text-red-400' : 'text-[var(--text-muted)]'}">
                    {totalEvs()} / 510
                  </span>
                </div>
                <div class="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {#each STAT_KEYS as stat}
                    <div class="text-center">
                      <div class="text-[10px] font-medium text-[var(--text-muted)] mb-0.5">{STAT_NAMES[stat]}</div>
                      <input type="number" value={currentMon.evs[stat]}
                        onchange={(e) => setEv(stat, parseInt((e.target as HTMLInputElement).value) || 0)}
                        class="w-full px-1 py-1 rounded bg-[var(--bg-card)] border border-[var(--border,#333)] text-center text-sm focus:border-[var(--accent)] focus:outline-none"
                        min="0" max="252" step="4" />
                      <div class="flex gap-0.5 mt-0.5 justify-center">
                        <button onclick={() => evPreset(stat, 0)} class="text-[9px] px-1 rounded bg-[var(--bg-card)] hover:bg-[var(--bg-primary)] transition-colors">0</button>
                        <button onclick={() => evPreset(stat, 252)} class="text-[9px] px-1 rounded bg-[var(--bg-card)] hover:bg-[var(--bg-primary)] transition-colors">252</button>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>

              <!-- IVs -->
              <div>
                <label class="text-xs font-medium text-[var(--text-muted)] mb-1 block">IVs</label>
                <div class="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {#each STAT_KEYS as stat}
                    <div class="text-center">
                      <div class="text-[10px] font-medium text-[var(--text-muted)] mb-0.5">{STAT_NAMES[stat]}</div>
                      <input type="number" value={currentMon.ivs[stat]}
                        onchange={(e) => setIv(stat, parseInt((e.target as HTMLInputElement).value) || 0)}
                        class="w-full px-1 py-1 rounded bg-[var(--bg-card)] border border-[var(--border,#333)] text-center text-sm focus:border-[var(--accent)] focus:outline-none"
                        min="0" max="31" />
                    </div>
                  {/each}
                </div>
              </div>

              <!-- Extras: Level, Tera Type, Shiny -->
              <div class="grid grid-cols-3 gap-4">
                <div>
                  <label class="block text-xs font-medium text-[var(--text-muted)] mb-1">Level</label>
                  <input type="number" value={currentMon.level}
                    onchange={(e) => setLevel(parseInt((e.target as HTMLInputElement).value) || 100)}
                    class="w-full px-3 py-2 rounded bg-[var(--bg-card)] border border-[var(--border,#333)] text-sm focus:border-[var(--accent)] focus:outline-none"
                    min="1" max="100" />
                </div>
                <div>
                  <label class="block text-xs font-medium text-[var(--text-muted)] mb-1">Tera Type</label>
                  <select value={currentMon.teraType} onchange={(e) => setTeraType((e.target as HTMLSelectElement).value)}
                    class="w-full px-3 py-2 rounded bg-[var(--bg-card)] border border-[var(--border,#333)] text-sm focus:border-[var(--accent)] focus:outline-none">
                    <option value="">None</option>
                    {#each TYPES as t}
                      <option value={t}>{t}</option>
                    {/each}
                  </select>
                </div>
                <div class="flex items-end">
                  <button onclick={toggleShiny}
                    class="w-full px-3 py-2 rounded border text-sm transition-colors {currentMon.shiny ? 'bg-yellow-600/20 border-yellow-500 text-yellow-300' : 'bg-[var(--bg-card)] border-[var(--border,#333)] text-[var(--text-muted)]'}">
                    {currentMon.shiny ? '✨ Shiny' : '☆ Not Shiny'}
                  </button>
                </div>
              </div>
            </div>

            <!-- Right: Sprite Preview + Base Stats -->
            <div class="flex flex-col items-center gap-4">
              {#if currentMon.species}
                <div class="bg-[var(--bg-card)] rounded-xl p-4 w-full flex flex-col items-center">
                  <img src={spriteUrl(currentMon.species)} alt={currentMon.species}
                    class="w-24 h-24" style="image-rendering: pixelated;"
                    onerror={(e) => { (e.target as HTMLImageElement).src = iconUrl(currentMon.species); }} />
                  <h3 class="font-bold text-sm mt-2">{currentMon.species}</h3>
                  {#if getSpeciesInfo(currentMon.species)}
                    {@const info = getSpeciesInfo(currentMon.species)!}
                    <div class="flex gap-1 mt-1">
                      {#each info.types as t}
                        <span class="text-[10px] px-2 py-0.5 rounded-full font-bold" style="background: {TYPE_COLORS[t]}; color: white; text-shadow: 0 1px 2px rgba(0,0,0,.5)">{t}</span>
                      {/each}
                    </div>
                    <!-- Base Stats -->
                    <div class="w-full mt-3 space-y-1">
                      {#each STAT_KEYS as stat}
                        {@const val = info.baseStats[stat]}
                        {@const pct = Math.min(100, (val / 180) * 100)}
                        {@const hue = Math.min(120, (val / 150) * 120)}
                        <div class="flex items-center gap-1 text-[10px]">
                          <span class="w-6 text-right font-medium text-[var(--text-muted)]">{STAT_NAMES[stat]}</span>
                          <span class="w-7 text-right font-mono">{val}</span>
                          <div class="flex-1 h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                            <div class="h-full rounded-full transition-all" style="width: {pct}%; background: hsl({hue}, 70%, 50%)"></div>
                          </div>
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>
              {:else}
                <div class="bg-[var(--bg-card)] rounded-xl p-8 w-full flex items-center justify-center text-[var(--text-muted)] text-sm">
                  Select a species
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- ════════════════════════ TEAM LIST ════════════════════════ -->
  {#if tab === 'list'}
    <!-- Editing overlay (paste editing) -->
    {#if editingTeam}
      <div class="bg-[var(--bg-secondary)] rounded-xl p-6 mb-6 border border-[var(--accent)]">
        <h2 class="text-lg font-semibold mb-4">Edit: {editingTeam.name}</h2>
        <div class="flex gap-2 mb-4">
          <button onclick={() => { const t = editingTeam; editingTeam = null; if (t) editTeamBuilder(t); }}
            class="bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-4 py-2 rounded text-sm font-medium transition-colors">
            ✨ Edit Visually
          </button>
          <span class="text-[var(--text-muted)] text-sm self-center">or edit paste below:</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-sm font-medium mb-1">Team Name</label>
            <input type="text" bind:value={editingTeam.name}
              class="w-full px-3 py-2 rounded bg-[var(--bg-card)] border border-[var(--border,#333)] focus:border-[var(--accent)] focus:outline-none" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Format</label>
            <select bind:value={editingTeam.format}
              class="w-full px-3 py-2 rounded bg-[var(--bg-card)] border border-[var(--border,#333)] focus:border-[var(--accent)] focus:outline-none">
              {#each FORMATS as f}
                <option value={f.id}>{f.name}</option>
              {/each}
            </select>
          </div>
        </div>
        <div class="mb-4">
          <label class="block text-sm font-medium mb-1">Showdown Paste</label>
          <textarea bind:value={editingTeam.paste} rows={12}
            class="w-full px-3 py-2 rounded bg-[var(--bg-card)] border border-[var(--border,#333)] focus:border-[var(--accent)] focus:outline-none font-mono text-sm resize-y"></textarea>
        </div>
        <div class="flex gap-2">
          <button onclick={savePasteEdit}
            class="bg-green-600 hover:bg-green-500 px-6 py-2 rounded font-medium text-sm transition-colors">Save</button>
          <button onclick={() => editingTeam = null}
            class="bg-[var(--bg-card)] px-6 py-2 rounded text-sm transition-colors">Cancel</button>
        </div>
      </div>
    {/if}

    {#if teams.length === 0 && !editingTeam}
      <div class="text-center py-16 text-[var(--text-muted)]">
        <p class="text-5xl mb-4">🏗️</p>
        <p class="text-lg mb-2">No teams yet</p>
        <p class="text-sm mb-6">Build a team visually or import a Showdown paste.</p>
        <div class="flex gap-3 justify-center">
          <button onclick={startBuilder}
            class="bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-6 py-2 rounded font-medium text-sm transition-colors">
            ✨ Build Team
          </button>
          <button onclick={() => { tab = 'import'; importError = ''; }}
            class="bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)] px-6 py-2 rounded font-medium text-sm transition-colors">
            📄 Import Paste
          </button>
        </div>
      </div>
    {:else if !editingTeam}
      <div class="space-y-3">
        {#each teams as team}
          <div class="bg-[var(--bg-secondary)] rounded-lg p-4 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <!-- Pokemon icons preview -->
              <div class="flex -space-x-1">
                {#each parsePaste(team.paste).slice(0, 6) as mon}
                  {#if mon.species}
                    <img src={iconUrl(mon.species)} alt={mon.species}
                      class="w-8 h-8 rounded-full bg-[var(--bg-card)]" style="image-rendering: pixelated;"
                      onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} title={mon.species} />
                  {/if}
                {/each}
              </div>
              <div>
                <h3 class="font-semibold">{team.name}</h3>
                <p class="text-sm text-[var(--text-muted)]">
                  {FORMATS.find(f => f.id === team.format)?.name ?? team.format}
                  · {team.pokemonCount} Pokémon
                </p>
              </div>
            </div>
            <div class="flex gap-2">
              <button onclick={() => exportTeam(team)}
                class="bg-[var(--bg-card)] hover:bg-[var(--bg-primary)] px-3 py-1 rounded text-sm transition-colors" title="Copy paste to clipboard">📋</button>
              <button onclick={() => editTeamBuilder(team)}
                class="bg-[var(--bg-card)] hover:bg-[var(--bg-primary)] px-3 py-1 rounded text-sm transition-colors" title="Edit visually">✨</button>
              <button onclick={() => startPasteEdit(team)}
                class="bg-[var(--bg-card)] hover:bg-[var(--bg-primary)] px-3 py-1 rounded text-sm transition-colors" title="Edit paste">✏️</button>
              <button onclick={() => deleteTeam(team.id)}
                class="bg-red-900/30 hover:bg-red-800/30 text-red-300 px-3 py-1 rounded text-sm transition-colors">🗑️</button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>
