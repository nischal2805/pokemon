<!--
  MoveEffect.svelte — Renders CSS-based move animation effects on the battlefield.
  Shows type-colored projectiles, slashes, bursts, beams, etc.
  Entirely pure CSS — no images needed.
-->
<script lang="ts">
  import { getMoveVisual, getMoveMeta, type EffectShape } from '$lib/moveEffects';

  interface Props {
    moveName?: string;
    attackerSide?: 'my' | 'opp';
    active: boolean;
  }
  let { moveName, attackerSide = 'my', active }: Props = $props();

  let meta = $derived(moveName ? getMoveMeta(moveName) : { type: 'Normal', category: 'Special' });
  let visual = $derived(getMoveVisual(meta.type, meta.category, meta.shape));

  let isMyAttack = $derived(attackerSide === 'my');

  // CSS variables for the effect
  let effectVars = $derived(`
    --fx-color: ${visual.color};
    --fx-glow: ${visual.glow};
    --fx-secondary: ${visual.secondary ?? visual.color};
  `);
</script>

{#if active && moveName}
  <div class="move-fx-layer" style={effectVars}>
    <!-- Projectile / effect shape -->
    {#if visual.shape === 'orb'}
      <div class="fx-orb {isMyAttack ? 'fx-fly-right' : 'fx-fly-left'}">
        <div class="fx-orb-inner"></div>
        <div class="fx-orb-trail"></div>
      </div>
      <!-- Impact on defender -->
      <div class="fx-impact {isMyAttack ? 'fx-impact-right' : 'fx-impact-left'}">
        <div class="fx-ring"></div>
        <div class="fx-ring fx-ring-2"></div>
      </div>

    {:else if visual.shape === 'beam'}
      <div class="fx-beam {isMyAttack ? 'fx-beam-right' : 'fx-beam-left'}"></div>
      <div class="fx-impact {isMyAttack ? 'fx-impact-right' : 'fx-impact-left'}">
        <div class="fx-spark"></div>
        <div class="fx-spark fx-spark-2"></div>
        <div class="fx-spark fx-spark-3"></div>
      </div>

    {:else if visual.shape === 'slash'}
      <div class="fx-slash-container {isMyAttack ? 'fx-slash-right' : 'fx-slash-left'}">
        <div class="fx-slash"></div>
        <div class="fx-slash fx-slash-2"></div>
      </div>

    {:else if visual.shape === 'burst'}
      <div class="fx-burst {isMyAttack ? 'fx-impact-right' : 'fx-impact-left'}">
        <div class="fx-burst-ring"></div>
        <div class="fx-burst-star"></div>
      </div>

    {:else if visual.shape === 'wave'}
      <div class="fx-wave {isMyAttack ? 'fx-wave-right' : 'fx-wave-left'}"></div>

    {:else if visual.shape === 'aura'}
      <div class="fx-aura {isMyAttack ? 'fx-aura-my' : 'fx-aura-opp'}">
        <div class="fx-aura-ring"></div>
        <div class="fx-aura-ring fx-aura-ring-2"></div>
        <div class="fx-aura-particles">
          <span></span><span></span><span></span><span></span><span></span>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .move-fx-layer {
    position: absolute;
    inset: 0;
    z-index: 15;
    pointer-events: none;
    overflow: hidden;
  }

  /* ═══ ORB (Special projectile) ═══ */
  .fx-orb {
    position: absolute;
    width: 32px;
    height: 32px;
    border-radius: 50%;
  }
  .fx-orb-inner {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, white 0%, var(--fx-color) 50%, var(--fx-secondary) 100%);
    box-shadow: 0 0 20px var(--fx-glow), 0 0 40px var(--fx-glow), 0 0 8px white;
    animation: orbPulse 0.15s ease-in-out infinite alternate;
  }
  .fx-orb-trail {
    position: absolute;
    top: 50%;
    width: 50px;
    height: 8px;
    transform: translateY(-50%);
    border-radius: 10px;
    background: linear-gradient(to left, var(--fx-color), transparent);
    opacity: 0.6;
  }
  .fx-fly-right {
    bottom: 60%;
    left: 12%;
    animation: flyToOpp 0.65s ease-in forwards;
  }
  .fx-fly-right .fx-orb-trail { right: 100%; }
  .fx-fly-left {
    top: 25%;
    right: 18%;
    animation: flyToMy 0.65s ease-in forwards;
  }
  .fx-fly-left .fx-orb-trail { left: 100%; transform: translateY(-50%) scaleX(-1); }

  @keyframes flyToOpp {
    0%   { transform: translate(0, 0) scale(0.5); opacity: 0; }
    15%  { transform: translate(30px, -20px) scale(1); opacity: 1; }
    85%  { transform: translate(320px, -120px) scale(1.1); opacity: 1; }
    100% { transform: translate(380px, -140px) scale(0.3); opacity: 0; }
  }
  @keyframes flyToMy {
    0%   { transform: translate(0, 0) scale(0.5); opacity: 0; }
    15%  { transform: translate(-30px, 20px) scale(1); opacity: 1; }
    85%  { transform: translate(-320px, 120px) scale(1.1); opacity: 1; }
    100% { transform: translate(-380px, 140px) scale(0.3); opacity: 0; }
  }
  @keyframes orbPulse {
    from { transform: scale(1); }
    to   { transform: scale(1.15); }
  }

  /* ═══ IMPACT (hit effects on defender) ═══ */
  .fx-impact {
    position: absolute;
    width: 80px;
    height: 80px;
    opacity: 0;
  }
  .fx-impact-right {
    top: 15%;
    right: 14%;
    animation: impactAppear 0.5s 0.55s ease-out forwards;
  }
  .fx-impact-left {
    bottom: 18%;
    left: 10%;
    animation: impactAppear 0.5s 0.55s ease-out forwards;
  }

  .fx-ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 3px solid var(--fx-color);
    box-shadow: 0 0 15px var(--fx-glow);
    animation: ringExpand 0.5s 0.45s ease-out forwards;
    opacity: 0;
  }
  .fx-ring-2 {
    animation-delay: 0.55s;
    border-width: 2px;
  }

  @keyframes impactAppear {
    0%   { opacity: 0; transform: scale(0.3); }
    40%  { opacity: 1; transform: scale(1.2); }
    100% { opacity: 0; transform: scale(1.5); }
  }
  @keyframes ringExpand {
    0%   { transform: scale(0.2); opacity: 0.9; }
    100% { transform: scale(2); opacity: 0; }
  }

  /* ═══ BEAM (Electric/Dragon) ═══ */
  .fx-beam {
    position: absolute;
    height: 6px;
    border-radius: 3px;
    background: linear-gradient(90deg, transparent 0%, var(--fx-color) 20%, white 50%, var(--fx-color) 80%, transparent 100%);
    box-shadow: 0 0 12px var(--fx-glow), 0 0 24px var(--fx-glow), 0 -3px 8px var(--fx-secondary), 0 3px 8px var(--fx-secondary);
    opacity: 0;
  }
  .fx-beam-right {
    bottom: 55%;
    left: 10%;
    width: 0;
    transform: rotate(-22deg);
    transform-origin: left center;
    animation: beamShoot 0.5s 0.1s ease-out forwards, beamFade 0.25s 0.65s ease-in forwards;
  }
  .fx-beam-left {
    top: 25%;
    right: 15%;
    width: 0;
    transform: rotate(22deg);
    transform-origin: right center;
    animation: beamShootLeft 0.5s 0.1s ease-out forwards, beamFade 0.25s 0.65s ease-in forwards;
  }
  @keyframes beamShoot {
    0%   { width: 0; opacity: 0.5; }
    30%  { opacity: 1; }
    100% { width: 60%; opacity: 1; }
  }
  @keyframes beamShootLeft {
    0%   { width: 0; opacity: 0.5; }
    30%  { opacity: 1; }
    100% { width: 60%; opacity: 1; }
  }
  @keyframes beamFade {
    to { opacity: 0; height: 12px; filter: blur(4px); }
  }

  /* ═══ Beam sparks ═══ */
  .fx-spark {
    position: absolute;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 0 8px var(--fx-color);
    opacity: 0;
  }
  .fx-spark   { animation: sparkFly1 0.4s 0.5s ease-out forwards; }
  .fx-spark-2 { animation: sparkFly2 0.4s 0.52s ease-out forwards; }
  .fx-spark-3 { animation: sparkFly3 0.4s 0.48s ease-out forwards; }

  @keyframes sparkFly1 {
    0%   { transform: translate(0, 0); opacity: 1; }
    100% { transform: translate(30px, -25px); opacity: 0; }
  }
  @keyframes sparkFly2 {
    0%   { transform: translate(0, 0); opacity: 1; }
    100% { transform: translate(-20px, -30px); opacity: 0; }
  }
  @keyframes sparkFly3 {
    0%   { transform: translate(0, 0); opacity: 1; }
    100% { transform: translate(25px, 20px); opacity: 0; }
  }

  /* ═══ SLASH (Physical contact) ═══ */
  .fx-slash-container {
    position: absolute;
    width: 100px;
    height: 100px;
    opacity: 0;
  }
  .fx-slash-right {
    top: 12%;
    right: 14%;
    animation: slashAppear 0.4s 0.3s ease-out forwards;
  }
  .fx-slash-left {
    bottom: 15%;
    left: 8%;
    animation: slashAppear 0.4s 0.3s ease-out forwards;
  }
  .fx-slash {
    position: absolute;
    top: 50%;
    left: 10%;
    width: 80%;
    height: 4px;
    border-radius: 2px;
    background: linear-gradient(90deg, transparent, var(--fx-color), white, var(--fx-color), transparent);
    box-shadow: 0 0 10px var(--fx-glow);
    transform: rotate(-35deg);
    animation: slashDraw 0.25s 0.3s ease-out both;
  }
  .fx-slash-2 {
    transform: rotate(-55deg);
    animation-delay: 0.38s;
    top: 55%;
    left: 15%;
    height: 3px;
    opacity: 0.7;
  }

  @keyframes slashAppear {
    0%   { opacity: 0; transform: scale(0.5); }
    30%  { opacity: 1; transform: scale(1.1); }
    100% { opacity: 0; transform: scale(1.3); }
  }
  @keyframes slashDraw {
    0%   { clip-path: inset(0 100% 0 0); opacity: 0; }
    30%  { opacity: 1; }
    100% { clip-path: inset(0 0 0 0); opacity: 0; }
  }

  /* ═══ BURST (Fighting/Rock impact) ═══ */
  .fx-burst {
    width: 90px;
    height: 90px;
    opacity: 0;
  }
  .fx-burst-ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: radial-gradient(circle, white 0%, var(--fx-color) 40%, transparent 70%);
    box-shadow: 0 0 30px var(--fx-glow);
    animation: burstExpand 0.4s 0.35s ease-out forwards;
    opacity: 0;
  }
  .fx-burst-star {
    position: absolute;
    inset: 15%;
    background: var(--fx-color);
    clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
    box-shadow: 0 0 20px var(--fx-glow);
    animation: burstStar 0.5s 0.3s ease-out forwards;
    opacity: 0;
  }
  @keyframes burstExpand {
    0%   { transform: scale(0); opacity: 1; }
    60%  { opacity: 0.8; }
    100% { transform: scale(2.5); opacity: 0; }
  }
  @keyframes burstStar {
    0%   { transform: scale(0) rotate(0deg); opacity: 1; }
    50%  { transform: scale(1.5) rotate(30deg); opacity: 0.8; }
    100% { transform: scale(2) rotate(60deg); opacity: 0; }
  }

  /* ═══ WAVE (Water/Ground/Flying) ═══ */
  .fx-wave {
    position: absolute;
    width: 100%;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(transparent 0%, var(--fx-color) 50%, transparent 100%);
    box-shadow: 0 0 20px var(--fx-glow);
    opacity: 0;
  }
  .fx-wave-right {
    bottom: 45%;
    left: 0;
    animation: waveToRight 0.7s 0.15s ease-out forwards;
    transform-origin: left center;
  }
  .fx-wave-left {
    top: 30%;
    right: 0;
    animation: waveToLeft 0.7s 0.15s ease-out forwards;
    transform-origin: right center;
  }
  @keyframes waveToRight {
    0%   { transform: scaleX(0) scaleY(0.5); opacity: 0; }
    30%  { opacity: 0.7; }
    70%  { transform: scaleX(0.8) scaleY(1); opacity: 0.5; }
    100% { transform: scaleX(1.1) scaleY(0.3); opacity: 0; }
  }
  @keyframes waveToLeft {
    0%   { transform: scaleX(0) scaleY(0.5); opacity: 0; }
    30%  { opacity: 0.7; }
    70%  { transform: scaleX(0.8) scaleY(1); opacity: 0.5; }
    100% { transform: scaleX(1.1) scaleY(0.3); opacity: 0; }
  }

  /* ═══ AURA (Status moves — glow around self) ═══ */
  .fx-aura {
    position: absolute;
    width: 120px;
    height: 120px;
    opacity: 0;
  }
  .fx-aura-my {
    bottom: 12%;
    left: 5%;
    animation: auraAppear 0.9s 0.1s ease-out forwards;
  }
  .fx-aura-opp {
    top: 8%;
    right: 12%;
    animation: auraAppear 0.9s 0.1s ease-out forwards;
  }
  .fx-aura-ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid var(--fx-color);
    box-shadow: 0 0 20px var(--fx-glow), inset 0 0 20px var(--fx-glow);
    animation: auraRing 1s ease-out infinite;
    opacity: 0.6;
  }
  .fx-aura-ring-2 {
    animation-delay: 0.3s;
    inset: -10px;
    border-width: 1px;
    opacity: 0.3;
  }
  .fx-aura-particles span {
    position: absolute;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--fx-color);
    box-shadow: 0 0 6px var(--fx-glow);
  }
  .fx-aura-particles span:nth-child(1) { left: 20%; top: 10%; animation: particleFloat 0.8s 0.1s ease-out forwards; }
  .fx-aura-particles span:nth-child(2) { right: 15%; top: 25%; animation: particleFloat 0.8s 0.2s ease-out forwards; }
  .fx-aura-particles span:nth-child(3) { left: 50%; top: 0%; animation: particleFloat 0.8s 0.15s ease-out forwards; }
  .fx-aura-particles span:nth-child(4) { left: 10%; bottom: 20%; animation: particleFloat 0.8s 0.25s ease-out forwards; }
  .fx-aura-particles span:nth-child(5) { right: 25%; bottom: 10%; animation: particleFloat 0.8s 0.3s ease-out forwards; }

  @keyframes auraAppear {
    0%   { opacity: 0; transform: scale(0.5); }
    30%  { opacity: 1; transform: scale(1); }
    80%  { opacity: 0.6; transform: scale(1.1); }
    100% { opacity: 0; transform: scale(1.3); }
  }
  @keyframes auraRing {
    0%   { transform: scale(0.8); opacity: 0.6; }
    50%  { transform: scale(1.1); opacity: 0.3; }
    100% { transform: scale(0.8); opacity: 0.6; }
  }
  @keyframes particleFloat {
    0%   { transform: translateY(0) scale(1); opacity: 1; }
    100% { transform: translateY(-30px) scale(0); opacity: 0; }
  }
</style>
