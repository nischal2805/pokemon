<script lang="ts">
  import HPBar from './HPBar.svelte';
  import MoveEffect from './MoveEffect.svelte';
  import EventToast from './EventToast.svelte';
  import { spriteUrl, iconUrl, itemUrl, onSpriteError, staticSpriteUrl } from '$lib/sprites';
  import { animEvent, visibleLog } from '$lib/stores/animQueue';

  interface Props {
    state: any;
  }
  let { state }: Props = $props();

  /* ── Move Effect state ── */
  let moveEffectActive = $derived($animEvent?.type === 'move' && !!$animEvent?.value);
  let moveEffectName = $derived($animEvent?.type === 'move' ? ($animEvent?.value ?? '') : '');
  let moveEffectSide = $derived<'my' | 'opp'>($animEvent?.target ?? 'my');

  /* ── Our Side (from request — for moves/team panel) ── */
  let myTeam = $derived(state?.request?.side?.pokemon ?? []);
  let myUsername = $derived(
    state?.mySide === 'p1' ? state?.p1?.username : state?.p2?.username
  );

  /* ── Our Side visual state — derived from visibleLog so HP/sprite sync with animations ── */
  let mySide = $derived(state?.mySide ?? 'p1');

  let myVisualState = $derived.by(() => {
    const log: string[] = $visibleLog;
    const side = mySide;
    const prefix = `${side}a: `;
    let activeName: string | null = null;
    let activeSpecies: string | null = null;
    let activeLevel = 100;
    let activeHP = '100/100';
    let activeHPPercent = 100;
    let activeFainted = false;
    let activeStatus = '';
    let activeItem = '';

    for (const line of log) {
      const parts = line.split('|');
      const cmd = parts[1];
      const ident = parts[2] ?? '';
      if (cmd === 'switch' || cmd === 'drag' || cmd === 'replace') {
        if (!ident.startsWith(prefix) && !ident.startsWith(`${side}: `)) continue;
        const name = ident.includes(': ') ? ident.split(': ')[1] : ident;
        const details = parts[3] ?? '';
        const condition = parts[4] ?? '100/100';
        const levelMatch = details.match(/L(\d+)/);
        activeName = name;
        activeSpecies = details.split(',')[0].trim() || name;
        activeLevel = levelMatch ? parseInt(levelMatch[1]) : 100;
        activeHP = condition.split(' ')[0] || condition;
        activeHPPercent = parseHPPercent(condition);
        activeFainted = condition.includes('fnt');
        activeStatus = '';
        activeItem = '';
      }
      if (cmd === '-damage' || cmd === '-heal') {
        if (!ident.startsWith(prefix) && !ident.startsWith(`${side}: `)) continue;
        const condition = parts[3] ?? '0 fnt';
        activeHP = condition.split(' ')[0] || condition;
        activeHPPercent = parseHPPercent(condition);
        activeFainted = condition.includes('fnt');
        const cond = condition.split(' ');
        if (cond.length > 1 && !cond[1].includes('fnt')) activeStatus = cond[1];
      }
      if (cmd === '-status') {
        if (!ident.startsWith(prefix) && !ident.startsWith(`${side}: `)) continue;
        activeStatus = parts[3] ?? '';
      }
      if (cmd === '-curestatus') {
        if (!ident.startsWith(prefix) && !ident.startsWith(`${side}: `)) continue;
        activeStatus = '';
      }
      if (cmd === 'faint') {
        if (!ident.startsWith(prefix) && !ident.startsWith(`${side}: `)) continue;
        activeHP = '0 fnt'; activeHPPercent = 0; activeFainted = true;
      }
      if (cmd === '-formechange' || cmd === 'detailschange') {
        if (!ident.startsWith(prefix) && !ident.startsWith(`${side}: `)) continue;
        const newSpecies = (parts[3] ?? '').split(',')[0].trim();
        if (newSpecies) activeSpecies = newSpecies;
      }
      if (cmd === '-item') {
        if (!ident.startsWith(prefix) && !ident.startsWith(`${side}: `)) continue;
        activeItem = parts[3] ?? '';
      }
      if (cmd === '-enditem') {
        if (!ident.startsWith(prefix) && !ident.startsWith(`${side}: `)) continue;
        activeItem = '';
      }
    }

    // Fall back to request data if no log lines have played yet
    if (!activeName && state?.request?.side?.pokemon) {
      const reqActive = state.request.side.pokemon.find((p: any) => p.active);
      if (reqActive) {
        activeName = parseName(reqActive.ident);
        activeSpecies = reqActive.details?.split(',')[0]?.trim() ?? activeName;
        activeLevel = parseInt(reqActive.details?.match(/L(\d+)/)?.[1] ?? '100');
        activeHP = reqActive.condition?.split(' ')[0] ?? '100/100';
        activeHPPercent = getHPPercent(reqActive.condition ?? '100/100');
        activeFainted = isFainted(reqActive.condition ?? '');
        activeStatus = getStatus(reqActive.condition ?? '');
        activeItem = reqActive.item ?? '';
      }
    }

    return {
      name: activeName,
      species: activeSpecies,
      level: activeLevel,
      hp: activeHP,
      hpPercent: activeHPPercent,
      fainted: activeFainted,
      status: activeStatus,
      item: activeItem,
    };
  });

  /* ── Opponent Side ── */
  let oppSide = $derived(state?.mySide === 'p1' ? 'p2' : 'p1');
  let oppUsername = $derived(state?.mySide === 'p1' ? state?.p2?.username : state?.p1?.username);

  /* ── Opponent state parsed from VISIBLE log (so HP syncs with animations) ── */
  interface OppPokemon {
    name: string;
    species: string;
    level: number;
    hp: string;
    hpPercent: number;
    fainted: boolean;
    active: boolean;
    status: string;
    item: string;
  }

  let oppState = $derived.by(() => {
    const log: string[] = $visibleLog;
    const side = oppSide;
    const prefix = `${side}a: `;
    const seen = new Map<string, OppPokemon>();
    let currentActive: string | null = null;

    for (const line of log) {
      const parts = line.split('|');
      const cmd = parts[1];

      if (cmd === 'switch' || cmd === 'drag' || cmd === 'replace') {
        const ident = parts[2] ?? '';
        if (!ident.startsWith(prefix) && !ident.startsWith(`${side}: `)) continue;
        const name = ident.includes(': ') ? ident.split(': ')[1] : ident;
        const details = parts[3] ?? '';
        const condition = parts[4] ?? '100/100';
        const levelMatch = details.match(/L(\d+)/);
        const level = levelMatch ? parseInt(levelMatch[1]) : 100;
        const species = details.split(',')[0].trim();

        if (currentActive && seen.has(currentActive))
          seen.get(currentActive)!.active = false;

        const existing = seen.get(name);
        seen.set(name, {
          name,
          species: species || name,
          level,
          hp: condition.split(' ')[0] || condition,
          hpPercent: parseHPPercent(condition),
          fainted: condition.includes('fnt'),
          active: true,
          status: existing?.status ?? '',
          item: existing?.item ?? '',
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
          const cond = condition.split(' ');
          if (cond.length > 1 && !cond[1].includes('fnt')) poke.status = cond[1];
        }
      }

      if (cmd === '-status') {
        const ident = parts[2] ?? '';
        if (!ident.startsWith(prefix) && !ident.startsWith(`${side}: `)) continue;
        const name = ident.includes(': ') ? ident.split(': ')[1] : ident;
        if (seen.has(name)) seen.get(name)!.status = parts[3] ?? '';
      }

      if (cmd === '-curestatus') {
        const ident = parts[2] ?? '';
        if (!ident.startsWith(prefix) && !ident.startsWith(`${side}: `)) continue;
        const name = ident.includes(': ') ? ident.split(': ')[1] : ident;
        if (seen.has(name)) seen.get(name)!.status = '';
      }

      if (cmd === 'faint') {
        const ident = parts[2] ?? '';
        if (!ident.startsWith(prefix) && !ident.startsWith(`${side}: `)) continue;
        const name = ident.includes(': ') ? ident.split(': ')[1] : ident;
        if (seen.has(name)) {
          const poke = seen.get(name)!;
          poke.hp = '0 fnt'; poke.hpPercent = 0; poke.fainted = true; poke.active = false;
        }
        if (currentActive === name) currentActive = null;
      }

      if (cmd === '-formechange' || cmd === 'detailschange') {
        const ident = parts[2] ?? '';
        if (!ident.startsWith(prefix) && !ident.startsWith(`${side}: `)) continue;
        const name = ident.includes(': ') ? ident.split(': ')[1] : ident;
        const newSpecies = (parts[3] ?? '').split(',')[0].trim();
        if (seen.has(name)) seen.get(name)!.species = newSpecies || name;
      }

      if (cmd === '-item') {
        const ident = parts[2] ?? '';
        if (!ident.startsWith(prefix) && !ident.startsWith(`${side}: `)) continue;
        const name = ident.includes(': ') ? ident.split(': ')[1] : ident;
        if (seen.has(name)) seen.get(name)!.item = parts[3] ?? '';
      }

      if (cmd === '-enditem') {
        const ident = parts[2] ?? '';
        if (!ident.startsWith(prefix) && !ident.startsWith(`${side}: `)) continue;
        const name = ident.includes(': ') ? ident.split(': ')[1] : ident;
        if (seen.has(name)) seen.get(name)!.item = '';
      }
    }

    const activeOpp = currentActive ? seen.get(currentActive) ?? null : null;
    return { active: activeOpp, team: [...seen.values()] };
  });

  /* ── Animation state from animQueue ── */
  let mySpriteClass = $derived.by(() => {
    const ev = $animEvent;
    if (!ev) return 'anim-idle';
    if (ev.type === 'switch-out' && ev.target === 'my') return 'anim-switch-out';
    if (ev.type === 'move' && ev.target === 'my') return 'anim-idle anim-attack-my';
    if (ev.type === 'damage' && ev.target === 'my') return 'anim-idle anim-hit';
    if (ev.type === 'faint' && ev.target === 'my') return 'anim-faint';
    if (ev.type === 'switch' && ev.target === 'my') return 'anim-slide-in-left';
    if (ev.type === 'mega' && ev.target === 'my') return 'anim-idle anim-mega';
    if (ev.type === 'heal' && ev.target === 'my') return 'anim-idle anim-heal';
    return 'anim-idle';
  });

  let oppSpriteClass = $derived.by(() => {
    const ev = $animEvent;
    if (!ev) return 'anim-idle';
    if (ev.type === 'switch-out' && ev.target === 'opp') return 'anim-switch-out';
    if (ev.type === 'move' && ev.target === 'opp') return 'anim-idle anim-attack-opp';
    if (ev.type === 'damage' && ev.target === 'opp') return 'anim-idle anim-hit';
    if (ev.type === 'faint' && ev.target === 'opp') return 'anim-faint';
    if (ev.type === 'switch' && ev.target === 'opp') return 'anim-slide-in-right';
    if (ev.type === 'mega' && ev.target === 'opp') return 'anim-idle anim-mega';
    if (ev.type === 'heal' && ev.target === 'opp') return 'anim-idle anim-heal';
    return 'anim-idle';
  });

  /* ── Utility functions ── */
  function parseHPPercent(condition: string): number {
    if (!condition || condition === '0 fnt') return 0;
    const hpPart = condition.split(' ')[0];
    const p = hpPart.split('/');
    if (p.length !== 2) return 100;
    return Math.round((parseInt(p[0]) / parseInt(p[1])) * 100);
  }

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

  function getStatus(condition: string): string {
    if (!condition) return '';
    const parts = condition.split(' ');
    if (parts.length > 1 && parts[1] !== 'fnt') return parts[1];
    return '';
  }
</script>

<!-- ═══ BATTLEFIELD ═══ -->
<div class="battlefield rounded-2xl relative overflow-hidden" style="min-height: 380px;">
  <!-- Battlefield background -->
  <div class="absolute inset-0 z-0">
    <div class="field-bg"></div>
  </div>

  <!-- Turn Counter -->
  {#if state.turn > 0}
    <div class="absolute top-3 right-1/2 translate-x-1/2 z-20
      bg-black/60 backdrop-blur-sm px-4 py-1 rounded-full
      text-xs font-bold text-white/70 tracking-wider">
      TURN {state.turn}
    </div>
  {/if}

  <!-- Live Event Toast Overlay -->
  <EventToast />

  <!-- Move Visual Effect Layer -->
  <MoveEffect
    moveName={moveEffectName}
    attackerSide={moveEffectSide}
    active={moveEffectActive}
  />

  <!-- ── OPPONENT (TOP RIGHT) ── -->
  <div class="absolute top-3 left-3 z-10" style="max-width: 55%;">
    <!-- Opponent info plate -->
    <div class="info-plate opp-plate">
      <div class="flex items-center gap-2 mb-1">
        <span class="text-xs font-bold text-white/90 tracking-wide">{oppUsername ?? 'Opponent'}</span>
      </div>
      {#if oppState.active}
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-bold text-sm text-white">{oppState.active.species}</span>
          <span class="text-[10px] text-white/50 font-medium">Lv{oppState.active.level}</span>
          {#if oppState.active.status}
            <span class="status-badge status-{oppState.active.status}">{oppState.active.status.toUpperCase()}</span>
          {/if}
        </div>
        <div class="mt-1 w-40">
          <HPBar percent={oppState.active.hpPercent} size="md" showText={true} />
        </div>
        {#if oppState.active.item}
          <div class="flex items-center gap-1 mt-1 text-[10px] text-yellow-300/80">
            <img src={itemUrl(oppState.active.item)} alt="" class="w-4 h-4" onerror={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
            <span>{oppState.active.item}</span>
          </div>
        {/if}
      {/if}
      <!-- Opp team pokeballs -->
      <div class="flex gap-1.5 mt-2">
        {#each oppState.team as opp}
          <div class="pokeball {opp.fainted ? 'fainted' : ''}"
            title="{opp.name}{opp.status ? ' [' + opp.status.toUpperCase() + ']' : ''} ({opp.fainted ? 'fainted' : opp.hp})"
          ></div>
        {/each}
        {#each Array(Math.max(0, 6 - oppState.team.length)) as _}
          <div class="pokeball" title="Unknown"></div>
        {/each}
      </div>
    </div>
  </div>

  <!-- ── Opponent sprite (top-right) ── -->
  <div class="absolute z-10 opp-sprite-area flex flex-col items-center">
    {#if oppState.active && !oppState.active.fainted}
      <div class={oppSpriteClass} style="position:relative;">
        <img
          src={spriteUrl(oppState.active.species)}
          alt={oppState.active.species}
          class="sprite-front drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
          style="image-rendering: pixelated;"
          onerror={onSpriteError}
        />
      </div>
      <div class="sprite-shadow opp-shadow"></div>
    {:else if oppState.active?.fainted}
      <div class="text-center opacity-30 text-5xl">💀</div>
    {:else}
      <div class="text-center opacity-20">
        <div class="text-6xl">?</div>
      </div>
    {/if}
  </div>

  <!-- ── My sprite (bottom-left) ── -->
  <div class="absolute z-10 my-sprite-area flex flex-col items-center">
    {#if myVisualState.species && !myVisualState.fainted}
      <div class={mySpriteClass} style="position:relative;">
        <img
          src={spriteUrl(myVisualState.species, true)}
          alt={myVisualState.name ?? '???'}
          class="sprite-back drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
          style="image-rendering: pixelated;"
          onerror={onSpriteError}
        />
      </div>
      <div class="sprite-shadow my-shadow"></div>
    {:else if myVisualState.fainted}
      <div class="text-center opacity-30 text-5xl">💀</div>
    {:else}
      <div class="text-center opacity-20">
        <div class="text-6xl">⚡</div>
      </div>
    {/if}
  </div>

  <!-- ── MY SIDE (BOTTOM RIGHT) ── -->
  <div class="absolute bottom-3 right-3 z-10" style="max-width: 55%;">
    <!-- My info plate -->
    <div class="info-plate my-plate">
      {#if myVisualState.species}
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-bold text-sm text-white">{myVisualState.name ?? '???'}</span>
          <span class="text-[10px] text-white/50 font-medium">
            Lv{myVisualState.level}
          </span>
          {#if myVisualState.status}
            <span class="status-badge status-{myVisualState.status}">
              {myVisualState.status.toUpperCase()}
            </span>
          {/if}
        </div>
        <div class="mt-1 w-44">
          <HPBar
            percent={myVisualState.hpPercent}
            size="md"
            showText={true}
            hpText={myVisualState.hp}
          />
        </div>
        {#if myVisualState.item}
          <div class="flex items-center gap-1 mt-1 text-[10px] text-yellow-300/80">
            <img src={itemUrl(myVisualState.item)} alt="" class="w-4 h-4" onerror={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
            <span>{myVisualState.item}</span>
          </div>
        {/if}
      {/if}
      <!-- My team pokeballs -->
      <div class="flex items-center gap-1 mt-1.5">
        <span class="text-[10px] text-white/40 mr-1">{myUsername ?? 'You'}</span>
        {#each myTeam as poke}
          <div class="pokeball {isFainted(poke.condition) ? 'fainted' : ''}"
            title="{parseName(poke.ident)}{getStatus(poke.condition) ? ' [' + getStatus(poke.condition).toUpperCase() + ']' : ''}"
          ></div>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .battlefield {
    background:
      linear-gradient(170deg, #1a3a2a 0%, #2d5a3f 30%, #3d7a5c 55%, #52b788 80%, #74c69d 100%);
    border: 2px solid #1a3a2a;
    box-shadow: inset 0 0 60px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.4);
  }

  .field-bg {
    width: 100%;
    height: 100%;
    background:
      /* Platform under opponent (top right) */
      radial-gradient(ellipse 45% 12% at 75% 42%, rgba(0,0,0,0.15) 0%, transparent 100%),
      /* Platform under player (bottom left) */
      radial-gradient(ellipse 40% 10% at 22% 85%, rgba(0,0,0,0.15) 0%, transparent 100%),
      /* Light from top */
      radial-gradient(ellipse 70% 30% at 50% 10%, rgba(255,255,255,0.05) 0%, transparent 100%),
      /* Grass texture hint */
      repeating-linear-gradient(90deg, transparent, transparent 30px, rgba(255,255,255,0.015) 30px, rgba(255,255,255,0.015) 32px);
  }

  .info-plate {
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 8px 14px;
  }

  .opp-plate { border-left: 3px solid #ef4444; }
  .my-plate  { border-left: 3px solid #3b82f6; }

  .sprite-front {
    width: 140px;
    height: 140px;
    object-fit: contain;
    transform: scaleX(-1);
  }

  .sprite-back {
    width: 130px;
    height: 130px;
    object-fit: contain;
  }

  .sprite-shadow {
    width: 80px;
    height: 12px;
    background: radial-gradient(ellipse, rgba(0,0,0,0.35) 0%, transparent 70%);
    margin-top: -6px;
  }
  .opp-shadow { width: 90px; }
  .my-shadow  { width: 70px; }

  .opp-sprite-area {
    right: 60px;
    top: 30px;
  }

  .my-sprite-area {
    left: 30px;
    bottom: 20px;
  }

  /* ── Sprite animations ── */
  @keyframes attackMy {
    0%   { transform: translate(0, 0); }
    30%  { transform: translate(40px, -25px) scale(1.05); }
    60%  { transform: translate(40px, -25px) scale(1.05); }
    100% { transform: translate(0, 0) scale(1); }
  }
  @keyframes attackOpp {
    0%   { transform: translate(0, 0); }
    30%  { transform: translate(-40px, 25px) scale(1.05); }
    60%  { transform: translate(-40px, 25px) scale(1.05); }
    100% { transform: translate(0, 0) scale(1); }
  }
  @keyframes hitShake {
    0%, 100% { transform: translateX(0); filter: brightness(1); }
    15% { transform: translateX(-8px); filter: brightness(2); }
    30% { transform: translateX(8px); filter: brightness(0.6); }
    45% { transform: translateX(-6px); filter: brightness(1.5); }
    60% { transform: translateX(6px); filter: brightness(0.8); }
    75% { transform: translateX(-3px); filter: brightness(1); }
  }
  @keyframes faintAnim {
    0%   { transform: translateY(0) scale(1); opacity: 1; filter: brightness(1); }
    100% { transform: translateY(50px) scale(0.5); opacity: 0; filter: brightness(0.2) saturate(0); }
  }
  @keyframes healGlow {
    0%   { filter: brightness(1); }
    50%  { filter: brightness(1.3) drop-shadow(0 0 8px rgba(100, 255, 150, 0.6)); }
    100% { filter: brightness(1); }
  }
  /* Switch-out: quickly shrink and fade the old sprite into its pokeball */
  @keyframes switchOut {
    0%   { transform: scale(1); opacity: 1; filter: brightness(1); }
    60%  { transform: scale(0.6); opacity: 0.5; filter: brightness(1.5) saturate(0.5); }
    100% { transform: scale(0) ; opacity: 0; filter: brightness(2) saturate(0); }
  }
  /* Slide-in from left (player side) */
  @keyframes slideInLeft {
    0%   { transform: translateX(-60px) scale(0.3); opacity: 0; }
    40%  { transform: translateX(5px) scale(1.05); opacity: 1; }
    100% { transform: translateX(0) scale(1); opacity: 1; }
  }
  /* Slide-in from right (opponent side) */
  @keyframes slideInRight {
    0%   { transform: translateX(60px) scale(0.3); opacity: 0; }
    40%  { transform: translateX(-5px) scale(1.05); opacity: 1; }
    100% { transform: translateX(0) scale(1); opacity: 1; }
  }

  :global(.anim-attack-my)    { animation: attackMy 0.8s ease-in-out; }
  :global(.anim-attack-opp)   { animation: attackOpp 0.8s ease-in-out; }
  :global(.anim-hit)          { animation: hitShake 0.7s ease-in-out; }
  :global(.anim-faint)        { animation: faintAnim 1s ease-in forwards; }
  :global(.anim-heal)         { animation: healGlow 0.8s ease-in-out; }
  :global(.anim-switch-out)   { animation: switchOut 0.25s ease-in forwards; }
  :global(.anim-slide-in-left)  { animation: slideInLeft 0.5s ease-out; }
  :global(.anim-slide-in-right) { animation: slideInRight 0.5s ease-out; }
</style>
