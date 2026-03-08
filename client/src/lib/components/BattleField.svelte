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

  /* ── Battle background themes ── */
  const BG_THEMES = [
    { name: 'Forest',   outer: 'linear-gradient(170deg, #1a3a2a 0%, #2d5a3f 30%, #3d7a5c 55%, #52b788 80%, #74c69d 100%)', border: '#1a3a2a', platform: 'rgba(0,0,0,0.15)' },
    { name: 'Cave',     outer: 'linear-gradient(170deg, #0e0e1e 0%, #1a1a30 30%, #252545 55%, #2e2e58 80%, #3a3a6e 100%)', border: '#08080e', platform: 'rgba(120,100,220,0.12)' },
    { name: 'Ocean',    outer: 'linear-gradient(170deg, #051525 0%, #0a2d5a 30%, #0d47a1 55%, #1565c0 80%, #29b6f6 100%)', border: '#03101a', platform: 'rgba(255,255,255,0.1)' },
    { name: 'Tundra',   outer: 'linear-gradient(170deg, #0a1828 0%, #12294a 30%, #1a3d6e 55%, #22558e 80%, #3a7ab5 100%)', border: '#060f18', platform: 'rgba(150,210,255,0.12)' },
    { name: 'Desert',   outer: 'linear-gradient(170deg, #3d1f00 0%, #6b3500 30%, #994d0a 55%, #b5651d 80%, #d4892e 100%)', border: '#250f00', platform: 'rgba(0,0,0,0.18)' },
    { name: 'Volcanic', outer: 'linear-gradient(170deg, #0d0300 0%, #2a0800 30%, #4a1000 55%, #741a00 80%, #a82800 100%)', border: '#080200', platform: 'rgba(255,80,0,0.14)' },
    { name: 'Sky',      outer: 'linear-gradient(170deg, #0d1b3e 0%, #1a3260 30%, #2a5090 55%, #3a70b8 80%, #5a9fd4 100%)', border: '#080f24', platform: 'rgba(255,255,255,0.1)' },
  ] as const;
  let bgTheme = $state(BG_THEMES[Math.floor(Math.random() * BG_THEMES.length)]);

  /* ── Field State (weather, terrain, hazards, screens, field effects) ── */
  interface SideConditions {
    stealthRock: boolean;
    spikes: number;      // 0–3
    toxicSpikes: number; // 0–2
    stickyWeb: boolean;
    reflect: boolean;
    lightScreen: boolean;
    auroraVeil: boolean;
  }
  const emptySide = (): SideConditions => ({
    stealthRock: false, spikes: 0, toxicSpikes: 0, stickyWeb: false,
    reflect: false, lightScreen: false, auroraVeil: false,
  });

  let fieldState = $derived.by(() => {
    const log: string[] = $visibleLog;
    const side = mySide;
    const oppS = oppSide;
    let weather: string | null = null;
    let terrain: string | null = null;
    let trickRoom = false, magicRoom = false, wonderRoom = false, gravity = false;
    const myC = emptySide();
    const oppC = emptySide();

    const getSide = (ident: string) =>
      ident.startsWith(`${side}:`) || ident.startsWith(`${side} `) ? myC :
      ident.startsWith(`${oppS}:`) || ident.startsWith(`${oppS} `) ? oppC : null;

    for (const line of log) {
      const p = line.split('|');
      const cmd = p[1];

      if (cmd === '-weather') {
        const w = p[2] ?? '';
        if (w === 'none') weather = null;
        else if (w === 'RainDance') weather = 'rain';
        else if (w === 'Sandstorm') weather = 'sand';
        else if (w === 'SunnyDay') weather = 'sun';
        else if (w === 'Hail') weather = 'hail';
        else if (w === 'Snow') weather = 'snow';
        else if (w === 'PrimordialSea') weather = 'rain';
        else if (w === 'DesolateLand') weather = 'sun';
        else if (w === 'DeltaStream') weather = 'wind';
      }

      if (cmd === '-fieldstart') {
        const eff = p[3] ?? p[2] ?? '';
        if (eff.includes('Electric Terrain'))  terrain = 'electric';
        else if (eff.includes('Grassy Terrain'))  terrain = 'grassy';
        else if (eff.includes('Psychic Terrain')) terrain = 'psychic';
        else if (eff.includes('Misty Terrain'))   terrain = 'misty';
        else if (eff.includes('Trick Room'))  trickRoom = true;
        else if (eff.includes('Magic Room'))  magicRoom = true;
        else if (eff.includes('Wonder Room')) wonderRoom = true;
        else if (eff.includes('Gravity'))     gravity = true;
      }

      if (cmd === '-fieldend') {
        const eff = p[3] ?? p[2] ?? '';
        if (eff.includes('Terrain'))   terrain = null;
        if (eff.includes('Trick Room'))  trickRoom = false;
        if (eff.includes('Magic Room'))  magicRoom = false;
        if (eff.includes('Wonder Room')) wonderRoom = false;
        if (eff.includes('Gravity'))     gravity = false;
      }

      if (cmd === '-sidestart') {
        const sc = getSide(p[2] ?? '');
        const eff = p[3] ?? '';
        if (!sc) continue;
        if (eff.includes('Stealth Rock')) sc.stealthRock = true;
        else if (eff.includes('Spikes')) {
          if (eff.includes('Toxic')) sc.toxicSpikes = Math.min(2, sc.toxicSpikes + 1);
          else sc.spikes = Math.min(3, sc.spikes + 1);
        }
        else if (eff.includes('Sticky Web')) sc.stickyWeb = true;
        else if (eff.includes('Reflect'))     sc.reflect = true;
        else if (eff.includes('Light Screen')) sc.lightScreen = true;
        else if (eff.includes('Aurora Veil')) sc.auroraVeil = true;
      }

      if (cmd === '-sideend') {
        const sc = getSide(p[2] ?? '');
        const eff = p[3] ?? '';
        if (!sc) continue;
        if (eff.includes('Stealth Rock')) sc.stealthRock = false;
        else if (eff.includes('Spikes')) {
          if (eff.includes('Toxic')) sc.toxicSpikes = 0;
          else sc.spikes = 0;
        }
        else if (eff.includes('Sticky Web')) sc.stickyWeb = false;
        else if (eff.includes('Reflect'))     sc.reflect = false;
        else if (eff.includes('Light Screen')) sc.lightScreen = false;
        else if (eff.includes('Aurora Veil')) sc.auroraVeil = false;
      }
    }

    return { weather, terrain, trickRoom, magicRoom, wonderRoom, gravity, my: myC, opp: oppC };
  });

  const WEATHER_OVERLAY: Record<string, string> = {
    rain: 'rgba(20,60,180,0.22)',
    sun:  'rgba(255,160,0,0.18)',
    sand: 'rgba(160,100,20,0.22)',
    hail: 'rgba(180,220,255,0.14)',
    snow: 'rgba(200,230,255,0.14)',
    wind: 'rgba(100,160,220,0.12)',
  };
  const TERRAIN_COLOR: Record<string, string> = {
    electric: 'rgba(255,220,0,0.32)',
    grassy:   'rgba(80,200,80,0.28)',
    psychic:  'rgba(200,80,200,0.28)',
    misty:    'rgba(255,160,200,0.28)',
  };

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
    let activeSub = false;

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
        activeSub = false;
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
      if (cmd === '-start') {
        if (!ident.startsWith(prefix) && !ident.startsWith(`${side}: `)) continue;
        if ((parts[3] ?? '').includes('Substitute')) activeSub = true;
      }
      if (cmd === '-end') {
        if (!ident.startsWith(prefix) && !ident.startsWith(`${side}: `)) continue;
        if ((parts[3] ?? '').includes('Substitute')) activeSub = false;
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
      hasSubstitute: activeSub,
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
    hasSubstitute: boolean;
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
          hasSubstitute: false,
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

      if (cmd === '-start') {
        const ident = parts[2] ?? '';
        if (!ident.startsWith(prefix) && !ident.startsWith(`${side}: `)) continue;
        const name = ident.includes(': ') ? ident.split(': ')[1] : ident;
        if ((parts[3] ?? '').includes('Substitute') && seen.has(name)) seen.get(name)!.hasSubstitute = true;
      }

      if (cmd === '-end') {
        const ident = parts[2] ?? '';
        if (!ident.startsWith(prefix) && !ident.startsWith(`${side}: `)) continue;
        const name = ident.includes(': ') ? ident.split(': ')[1] : ident;
        if ((parts[3] ?? '').includes('Substitute') && seen.has(name)) seen.get(name)!.hasSubstitute = false;
      }
    }

    const activeOpp = currentActive ? seen.get(currentActive) ?? null : null;
    return { active: activeOpp, team: [...seen.values()] };
  });

  /* ── Opponent fallback from raw state.log when visibleLog hasn't played initial switches yet ── */
  let oppStateFinal = $derived.by(() => {
    if (oppState.active !== null) return oppState;
    // visibleLog is empty — scan state.log for the very first switch for opponent side
    // (this covers the ~950ms gap before the switch animation plays)
    const rawLog: string[] = state?.log ?? [];
    const side = oppSide;
    const prefix = `${side}a: `;
    for (const line of rawLog) {
      const parts = line.split('|');
      if (parts[1] === 'switch' || parts[1] === 'drag') {
        const ident = parts[2] ?? '';
        if (!ident.startsWith(prefix) && !ident.startsWith(`${side}: `)) continue;
        const name = ident.includes(': ') ? ident.split(': ')[1] : ident;
        const details = parts[3] ?? '';
        const condition = parts[4] ?? '100/100';
        const levelMatch = details.match(/L(\d+)/);
        return {
          active: {
            name,
            species: details.split(',')[0].trim() || name,
            level: levelMatch ? parseInt(levelMatch[1]) : 100,
            hp: condition.split(' ')[0] || condition,
            hpPercent: parseHPPercent(condition),
            fainted: condition.includes('fnt'),
            active: true,
            status: '',
            item: '',
            hasSubstitute: false,
          },
          team: oppState.team,
        };
      }
    }
    return oppState;
  });
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
<div class="battlefield rounded-2xl relative overflow-hidden"
  style="min-height: 380px;
    background: {bgTheme.outer};
    border-color: {bgTheme.border};
    box-shadow: inset 0 0 60px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.4);"
>
  <!-- Bg label (tiny, top-left corner) -->
  <span class="absolute top-1 left-2 z-10 text-[9px] text-white/20 font-mono select-none">{bgTheme.name}</span>
  <!-- Battlefield background -->
  <div class="absolute inset-0 z-0">
    <div class="field-bg"
      style="background:
        radial-gradient(ellipse 45% 12% at 75% 42%, {bgTheme.platform} 0%, transparent 100%),
        radial-gradient(ellipse 40% 10% at 22% 85%, {bgTheme.platform} 0%, transparent 100%),
        radial-gradient(ellipse 70% 30% at 50% 10%, rgba(255,255,255,0.05) 0%, transparent 100%);"
    ></div>
  </div>

  <!-- Weather overlay -->
  {#if fieldState.weather}
    <div class="absolute inset-0 z-1 pointer-events-none weather-overlay"
      style="background: {WEATHER_OVERLAY[fieldState.weather] ?? 'transparent'}"
    ></div>
  {/if}

  <!-- Terrain glow (bottom half) -->
  {#if fieldState.terrain}
    <div class="absolute bottom-0 left-0 right-0 z-1 pointer-events-none terrain-glow"
      style="background: radial-gradient(ellipse 100% 60% at 50% 100%, {TERRAIN_COLOR[fieldState.terrain]} 0%, transparent 70%);"
    ></div>
  {/if}

  <!-- Field effects banner (Trick Room / Magic Room / Wonder Room / Gravity) -->
  {#if fieldState.trickRoom || fieldState.magicRoom || fieldState.wonderRoom || fieldState.gravity}
    <div class="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
      {#if fieldState.trickRoom}  <span class="field-badge trick-room">⧉ Trick Room</span>   {/if}
      {#if fieldState.magicRoom}  <span class="field-badge magic-room">🔮 Magic Room</span>   {/if}
      {#if fieldState.wonderRoom} <span class="field-badge wonder-room">✨ Wonder Room</span>  {/if}
      {#if fieldState.gravity}    <span class="field-badge gravity">⬇ Gravity</span>          {/if}
    </div>
  {/if}

  <!-- Weather + Terrain status strip (top centre) -->
  {#if fieldState.weather || fieldState.terrain}
    <div class="absolute top-1 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
      {#if fieldState.weather}
        {@const WX: Record<string,string> = {rain:'🌧 Rain',sun:'☀ Sun',sand:'🌪 Sand',hail:'🌨 Hail',snow:'❄ Snow',wind:'🌀 Wind'}}
        <span class="field-badge weather-badge weather-{fieldState.weather}">{WX[fieldState.weather] ?? fieldState.weather}</span>
      {/if}
      {#if fieldState.terrain}
        {@const TR: Record<string,string> = {electric:'⚡ Electric Terrain',grassy:'🌿 Grassy Terrain',psychic:'🔮 Psychic Terrain',misty:'🌸 Misty Terrain'}}
        <span class="field-badge terrain-badge terrain-{fieldState.terrain}">{TR[fieldState.terrain] ?? fieldState.terrain}</span>
      {/if}
    </div>
  {/if}

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
      {#if oppStateFinal.active}
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-bold text-sm text-white">{oppStateFinal.active.species}</span>
          <span class="text-[10px] text-white/50 font-medium">Lv{oppStateFinal.active.level}</span>
          {#if oppStateFinal.active.status}
            <span class="status-badge status-{oppStateFinal.active.status}">{oppStateFinal.active.status.toUpperCase()}</span>
          {/if}
        </div>
        <div class="mt-1 w-40">
          <HPBar percent={oppStateFinal.active.hpPercent} size="md" showText={true} />
        </div>
        {#if oppStateFinal.active.item}
          <div class="flex items-center gap-1 mt-1 text-[10px] text-yellow-300/80">
            <img src={itemUrl(oppStateFinal.active.item)} alt="" class="w-4 h-4" onerror={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
            <span>{oppStateFinal.active.item}</span>
          </div>
        {/if}
      {/if}
      <!-- Opp team pokeballs -->
      <div class="flex gap-1.5 mt-2">
        {#each oppStateFinal.team as opp}
          <div class="pokeball {opp.fainted ? 'fainted' : ''}"
            title="{opp.name}{opp.status ? ' [' + opp.status.toUpperCase() + ']' : ''} ({opp.fainted ? 'fainted' : opp.hp})"
          ></div>
        {/each}
        {#each Array(Math.max(0, 6 - oppStateFinal.team.length)) as _}
          <div class="pokeball" title="Unknown"></div>
        {/each}
      </div>
      <!-- Opp side conditions -->
      {#if fieldState.opp.stealthRock || fieldState.opp.spikes || fieldState.opp.toxicSpikes || fieldState.opp.stickyWeb || fieldState.opp.reflect || fieldState.opp.lightScreen || fieldState.opp.auroraVeil}
        <div class="flex flex-wrap gap-1 mt-1.5">
          {#if fieldState.opp.stealthRock}  <span class="side-badge sr">⛏SR</span>                                           {/if}
          {#if fieldState.opp.spikes}       <span class="side-badge spk">📌×{fieldState.opp.spikes}</span>                    {/if}
          {#if fieldState.opp.toxicSpikes}  <span class="side-badge tspk">☠×{fieldState.opp.toxicSpikes}</span>               {/if}
          {#if fieldState.opp.stickyWeb}    <span class="side-badge web">🕸Web</span>                                         {/if}
          {#if fieldState.opp.reflect}      <span class="side-badge reflect">🛡Reflect</span>                                  {/if}
          {#if fieldState.opp.lightScreen}  <span class="side-badge screen">🛡Screen</span>                                    {/if}
          {#if fieldState.opp.auroraVeil}   <span class="side-badge veil">🛡Veil</span>                                        {/if}
        </div>
      {/if}
    </div>
  </div>

  <!-- ── Opponent sprite (top-right) ── -->
  <div class="absolute z-10 opp-sprite-area flex flex-col items-center">
    {#if oppStateFinal.active && !oppStateFinal.active.fainted}
      <div class={oppSpriteClass} style="position:relative;">
        {#if oppStateFinal.active.hasSubstitute}
          <div class="substitute-doll substitute-doll-opp" title="Substitute">🪆</div>
        {/if}
        <img
          src={spriteUrl(oppStateFinal.active.species)}
          alt={oppStateFinal.active.species}
          class="sprite-front drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)] {oppStateFinal.active.hasSubstitute ? 'behind-sub' : ''}"
          style="image-rendering: pixelated;"
          onerror={onSpriteError}
        />
      </div>
      <div class="sprite-shadow opp-shadow"></div>
    {:else if oppStateFinal.active?.fainted}
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
        {#if myVisualState.hasSubstitute}
          <div class="substitute-doll substitute-doll-my" title="Substitute">🪆</div>
        {/if}
        <img
          src={spriteUrl(myVisualState.species, true)}
          alt={myVisualState.name ?? '???'}
          class="sprite-back drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)] {myVisualState.hasSubstitute ? 'behind-sub' : ''}"
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
      <!-- My side conditions -->
      {#if fieldState.my.stealthRock || fieldState.my.spikes || fieldState.my.toxicSpikes || fieldState.my.stickyWeb || fieldState.my.reflect || fieldState.my.lightScreen || fieldState.my.auroraVeil}
        <div class="flex flex-wrap gap-1 mt-1.5">
          {#if fieldState.my.stealthRock}  <span class="side-badge sr">⛏SR</span>                                         {/if}
          {#if fieldState.my.spikes}       <span class="side-badge spk">📌×{fieldState.my.spikes}</span>                    {/if}
          {#if fieldState.my.toxicSpikes}  <span class="side-badge tspk">☠×{fieldState.my.toxicSpikes}</span>               {/if}
          {#if fieldState.my.stickyWeb}    <span class="side-badge web">🕸Web</span>                                       {/if}
          {#if fieldState.my.reflect}      <span class="side-badge reflect">🛡Reflect</span>                                {/if}
          {#if fieldState.my.lightScreen}  <span class="side-badge screen">🛡Screen</span>                                  {/if}
          {#if fieldState.my.auroraVeil}   <span class="side-badge veil">🛡Veil</span>                                      {/if}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .battlefield {
    border: 2px solid;
  }

  .field-bg {
    width: 100%;
    height: 100%;
  }

  /* Substitute doll overlay */
  :global(.substitute-doll) {
    position: absolute;
    font-size: 52px;
    z-index: 6;
    pointer-events: none;
    filter: drop-shadow(0 0 10px rgba(100,200,255,0.7));
    animation: subPulse 2s ease-in-out infinite;
  }
  :global(.substitute-doll-opp) { top: -8px; left: 50%; transform: translateX(-50%) scaleX(1); }
  :global(.substitute-doll-my)  { top: -8px; left: 50%; transform: translateX(-50%); }
  :global(.behind-sub) { opacity: 0.35; filter: brightness(0.6) saturate(0.4); }

  @keyframes subPulse {
    0%, 100% { transform: translateX(-50%) translateY(0); }
    50%       { transform: translateX(-50%) translateY(-4px); }
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

  /* ── Weather / terrain overlays ── */
  .weather-overlay { transition: background 1s ease; }
  .terrain-glow    { height: 55%; transition: background 1s ease; pointer-events: none; }

  /* ── Field/weather/terrain badges (top centre strip) ── */
  .field-badge, .weather-badge, .terrain-badge, .side-badge {
    display: inline-flex; align-items: center;
    font-size: 9px; font-weight: 700; letter-spacing: 0.04em;
    padding: 2px 6px; border-radius: 6px;
    backdrop-filter: blur(4px);
    border: 1px solid rgba(255,255,255,0.15);
    white-space: nowrap;
  }
  /* Weather badge colours */
  .weather-rain  { background: rgba(20,60,200,0.6); color: #93c5fd; }
  .weather-sun   { background: rgba(200,100,0,0.6); color: #fde68a; }
  .weather-sand  { background: rgba(120,70,10,0.7); color: #fbbf24; }
  .weather-hail  { background: rgba(100,150,220,0.55); color: #e0f2fe; }
  .weather-snow  { background: rgba(180,210,255,0.35); color: #f0f9ff; }
  .weather-wind  { background: rgba(60,120,200,0.45); color: #bae6fd; }
  /* Terrain badge colours */
  .terrain-electric { background: rgba(200,160,0,0.65); color: #fef08a; }
  .terrain-grassy   { background: rgba(30,130,30,0.65);  color: #86efac; }
  .terrain-psychic  { background: rgba(150,30,150,0.65); color: #e9d5ff; }
  .terrain-misty    { background: rgba(200,80,130,0.55); color: #fce7f3; }
  /* Field effect badges */
  .trick-room  { background: rgba(120,0,200,0.65); color: #e9d5ff; }
  .magic-room  { background: rgba(0,80,180,0.65);  color: #bae6fd; }
  .wonder-room { background: rgba(180,120,0,0.65); color: #fde68a; }
  .gravity     { background: rgba(40,40,40,0.75);  color: #d1d5db; }
  /* Side condition badges */
  .side-badge { font-size: 8px; padding: 1px 4px; border-radius: 4px; }
  .sr      { background: rgba(100,70,30,0.7);  color: #d6b87a; }
  .spk     { background: rgba(180,130,0,0.65); color: #fde68a; }
  .tspk    { background: rgba(100,0,120,0.7);  color: #d8b4fe; }
  .web     { background: rgba(80,50,10,0.7);   color: #c4a35a; }
  .reflect { background: rgba(20,60,200,0.6);  color: #93c5fd; }
  .screen  { background: rgba(180,130,0,0.65); color: #fde68a; }
  .veil    { background: rgba(100,180,200,0.55); color: #e0f2fe; }
</style>
