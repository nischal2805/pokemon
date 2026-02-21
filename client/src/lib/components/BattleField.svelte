<script lang="ts">
  import HPBar from './HPBar.svelte';

  interface Props {
    state: any;
  }
  let { state }: Props = $props();

  // Parse active pokemon from request for our side
  let myActive = $derived(state?.request?.side?.pokemon?.find((p: any) => p.active));
  let myTeam = $derived(state?.request?.side?.pokemon ?? []);

  // Opponent side identifier
  let oppSide = $derived(state?.mySide === 'p1' ? 'p2' : 'p1');
  let oppUsername = $derived(state?.mySide === 'p1' ? state?.p2?.username : state?.p1?.username);

  /**
   * Parse opponent's active pokemon and team status from the battle log.
   * We scan protocol lines like:
   *   |switch|p2a: Pikachu|Pikachu, L84, M|270/270
   *   |drag|p2a: Pikachu|Pikachu, L84, M|270/270
   *   |-damage|p2a: Pikachu|120/270
   *   |-heal|p2a: Pikachu|200/270
   *   |faint|p2a: Pikachu
   *   |replace|p2a: Pikachu|...
   */
  interface OppPokemon {
    name: string;
    species: string;
    level: number;
    hp: string;       // "120/270" or "0 fnt"
    hpPercent: number;
    fainted: boolean;
    active: boolean;
  }

  let oppState = $derived.by(() => {
    const log: string[] = state?.log ?? [];
    const side = oppSide;
    const prefix = `${side}a: `;

    // Track all opponent pokemon we've seen
    const seen = new Map<string, OppPokemon>();
    let currentActive: string | null = null;

    for (const line of log) {
      const parts = line.split('|');
      // parts[0] is empty (lines start with |)
      const cmd = parts[1];

      if (cmd === 'switch' || cmd === 'drag' || cmd === 'replace') {
        // |switch|p2a: Pikachu|Pikachu, L84, M|270/270
        const ident = parts[2] ?? '';
        if (!ident.startsWith(prefix) && !ident.startsWith(`${side}: `)) continue;
        const name = ident.includes(': ') ? ident.split(': ')[1] : ident;
        const details = parts[3] ?? '';
        const condition = parts[4] ?? '100/100';

        const levelMatch = details.match(/L(\d+)/);
        const level = levelMatch ? parseInt(levelMatch[1]) : 100;
        const species = details.split(',')[0].trim();

        // Mark old active as not active
        if (currentActive && seen.has(currentActive)) {
          seen.get(currentActive)!.active = false;
        }

        seen.set(name, {
          name,
          species: species || name,
          level,
          hp: condition.split(' ')[0] || condition,
          hpPercent: parseHPPercent(condition),
          fainted: condition.includes('fnt'),
          active: true,
        });
        currentActive = name;
      }

      if (cmd === '-damage' || cmd === '-heal') {
        const ident = parts[2] ?? '';
        if (!ident.startsWith(prefix) && !ident.startsWith(`${side}: `)) continue;
        const name = ident.includes(': ') ? ident.split(': ')[1] : ident;
        const condition = parts[3] ?? '0 fnt';

        if (seen.has(name)) {
          const poke = seen.get(name)!;
          poke.hp = condition.split(' ')[0] || condition;
          poke.hpPercent = parseHPPercent(condition);
          poke.fainted = condition.includes('fnt');
        }
      }

      if (cmd === 'faint') {
        const ident = parts[2] ?? '';
        if (!ident.startsWith(prefix) && !ident.startsWith(`${side}: `)) continue;
        const name = ident.includes(': ') ? ident.split(': ')[1] : ident;

        if (seen.has(name)) {
          const poke = seen.get(name)!;
          poke.hp = '0 fnt';
          poke.hpPercent = 0;
          poke.fainted = true;
          poke.active = false;
        }
        if (currentActive === name) currentActive = null;
      }

      if (cmd === '-formechange' || cmd === 'detailschange') {
        const ident = parts[2] ?? '';
        if (!ident.startsWith(prefix) && !ident.startsWith(`${side}: `)) continue;
        const name = ident.includes(': ') ? ident.split(': ')[1] : ident;
        const newDetails = parts[3] ?? '';
        const newSpecies = newDetails.split(',')[0].trim();

        if (seen.has(name)) {
          seen.get(name)!.species = newSpecies || name;
        }
      }
    }

    const activeOpp = currentActive ? seen.get(currentActive) ?? null : null;
    return { active: activeOpp, team: [...seen.values()] };
  });

  function parseHPPercent(condition: string): number {
    if (!condition || condition === '0 fnt') return 0;
    const hpPart = condition.split(' ')[0];
    const parts = hpPart.split('/');
    if (parts.length !== 2) return 100;
    return Math.round((parseInt(parts[0]) / parseInt(parts[1])) * 100);
  }

  // Get name from ident like "p1: Pikachu"
  function parseName(ident: string): string {
    if (!ident) return '???';
    const parts = ident.split(': ');
    return parts.length > 1 ? parts[1] : ident;
  }

  function getHPPercent(condition: string): number {
    if (!condition || condition === '0 fnt') return 0;
    const parts = condition.split(' ')[0].split('/');
    if (parts.length !== 2) return 100;
    return Math.round((parseInt(parts[0]) / parseInt(parts[1])) * 100);
  }

  function getHPText(condition: string): string {
    if (!condition || condition === '0 fnt') return '0/0';
    return condition.split(' ')[0];
  }

  function isFainted(condition: string): boolean {
    return !condition || condition === '0 fnt';
  }

  // Sprite URL from Pokémon Showdown
  function spriteUrl(name: string, back = false): string {
    if (!name) return '';
    const slug = name.toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace('mega-x', 'megax')
      .replace('mega-y', 'megay');
    const dir = back ? 'ani-back' : 'ani';
    return `https://play.pokemonshowdown.com/sprites/${dir}/${slug}.gif`;
  }
</script>

<div class="bg-[var(--bg-secondary)] rounded-xl p-4 relative overflow-hidden" style="min-height: 320px;">
  <!-- Opponent Side (top) -->
  <div class="flex items-start justify-between mb-4">
    <div>
      <div class="font-medium text-[var(--text-primary)] text-sm">
        {oppUsername ?? 'Opponent'}
      </div>
      <!-- Opponent team pokeballs -->
      <div class="flex gap-1 mt-1">
        {#each oppState.team as opp}
          <div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px]
            {opp.fainted ? 'bg-red-900/50 text-red-400' : opp.active ? 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-400' : 'bg-[var(--bg-card)] text-[var(--text-muted)]'}"
            title="{opp.name} ({opp.fainted ? 'fainted' : opp.hp})"
          >
            {opp.fainted ? '✕' : '●'}
          </div>
        {/each}
        <!-- Unknown remaining pokemon (6 total minus seen) -->
        {#each Array(Math.max(0, 6 - oppState.team.length)) as _}
          <div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] bg-[var(--bg-card)] text-[var(--text-muted)]"
            title="Unknown"
          >
            ?
          </div>
        {/each}
      </div>
    </div>

    <!-- Opponent active pokemon info -->
    {#if oppState.active}
      <div class="text-right">
        <div class="font-semibold text-sm">{oppState.active.species}</div>
        <div class="text-xs text-[var(--text-muted)]">Lv{oppState.active.level}</div>
        <div class="w-32">
          <HPBar percent={oppState.active.hpPercent} />
        </div>
      </div>
    {/if}
  </div>

  <!-- Battle Scene -->
  <div class="flex justify-between items-end px-8 py-4">
    <!-- Opponent Pokemon (front sprite) - top right -->
    <div class="flex-1 flex justify-center">
      {#if oppState.active}
        <div class="text-center">
          <img
            src={spriteUrl(oppState.active.species)}
            alt={oppState.active.species}
            class="w-28 h-28 object-contain drop-shadow-lg"
            style="image-rendering: pixelated;"
            onerror={(e) => {
              const el = e.target as HTMLImageElement;
              el.style.display = 'none';
              el.parentElement!.querySelector('.fallback')?.classList.remove('hidden');
            }}
          />
          <div class="fallback hidden text-4xl">🔴</div>
        </div>
      {:else}
        <div class="text-center text-[var(--text-muted)]">
          <span class="text-4xl opacity-40">❓</span>
        </div>
      {/if}
    </div>

    <!-- VS divider -->
    <div class="text-[var(--text-muted)] text-xs font-bold self-center">VS</div>

    <!-- My Pokemon (back sprite) - bottom left -->
    <div class="flex-1 flex justify-center">
      {#if myActive}
        <div class="text-center">
          <img
            src={spriteUrl(parseName(myActive.ident), true)}
            alt={parseName(myActive.ident)}
            class="w-28 h-28 object-contain drop-shadow-lg"
            style="image-rendering: pixelated;"
            onerror={(e) => {
              const el = e.target as HTMLImageElement;
              el.style.display = 'none';
              el.parentElement!.querySelector('.fallback')?.classList.remove('hidden');
            }}
          />
          <div class="fallback hidden text-4xl">🔵</div>
        </div>
      {:else}
        <div class="text-center text-[var(--text-muted)]">
          <span class="text-4xl opacity-40">⚡</span>
        </div>
      {/if}
    </div>
  </div>

  <!-- My Side (bottom) -->
  <div class="flex items-end justify-between mt-4">
    <!-- My active pokemon info -->
    {#if myActive}
      <div>
        <div class="font-semibold text-sm">{parseName(myActive.ident)}</div>
        <div class="text-xs text-[var(--text-muted)]">Lv{myActive.details?.match(/L(\d+)/)?.[1] ?? '100'}</div>
        <div class="w-32">
          <HPBar percent={getHPPercent(myActive.condition)} />
        </div>
        <div class="text-xs text-[var(--text-muted)]">{getHPText(myActive.condition)}</div>
      </div>
    {/if}

    <!-- My team pokeballs -->
    <div class="flex gap-1">
      {#each myTeam as poke}
        <div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px]
          {isFainted(poke.condition) ? 'bg-red-900/50 text-red-400' : poke.active ? 'bg-[var(--accent)]/20 text-[var(--accent)] ring-1 ring-[var(--accent)]' : 'bg-[var(--bg-card)] text-[var(--text-muted)]'}"
          title={parseName(poke.ident)}
        >
          {isFainted(poke.condition) ? '✕' : '●'}
        </div>
      {/each}
    </div>
  </div>

  <!-- Turn indicator -->
  {#if state.turn > 0}
    <div class="absolute top-2 right-3 text-xs text-[var(--text-muted)] bg-[var(--bg-card)]/80 px-2 py-0.5 rounded">
      Turn {state.turn}
    </div>
  {/if}
</div>
