<script lang="ts">
  import { tick } from 'svelte';

  interface Props {
    logs: string[];
  }
  let { logs }: Props = $props();

  let logContainer: HTMLDivElement | undefined = $state();

  // Auto-scroll to bottom on new logs
  $effect(() => {
    logs;
    tick().then(() => {
      if (logContainer) logContainer.scrollTop = logContainer.scrollHeight;
    });
  });

  function formatLine(line: string): { text: string; cls: string } {
    if (line.startsWith('|move|')) {
      const parts = line.split('|');
      return { text: `${parts[2]} used ${parts[3]}!`, cls: 'text-blue-300' };
    }
    if (line.startsWith('|-damage|') || line.startsWith('|-hurt|')) {
      const parts = line.split('|');
      return { text: `${parts[2]} took damage! (${parts[3]})`, cls: 'text-red-300' };
    }
    if (line.startsWith('|-heal|')) {
      const parts = line.split('|');
      return { text: `${parts[2]} healed! (${parts[3]})`, cls: 'text-green-300' };
    }
    if (line.startsWith('|switch|') || line.startsWith('|drag|')) {
      const parts = line.split('|');
      return { text: `${parts[2]} sent out ${parts[3]?.split(',')[0]}!`, cls: 'text-yellow-300' };
    }
    if (line.startsWith('|faint|')) {
      const parts = line.split('|');
      return { text: `${parts[2]} fainted!`, cls: 'text-red-500 font-bold' };
    }
    if (line.startsWith('|win|')) {
      const parts = line.split('|');
      return { text: `🎉 ${parts[2]} won the battle!`, cls: 'text-green-400 font-bold text-lg' };
    }
    if (line === '|tie' || line.startsWith('|tie|')) {
      return { text: '🤝 The battle ended in a tie!', cls: 'text-yellow-400 font-bold' };
    }
    if (line.startsWith('|turn|')) {
      const parts = line.split('|');
      return { text: `─── Turn ${parts[2]} ───`, cls: 'text-[var(--text-primary)] font-bold text-center' };
    }
    if (line.startsWith('|-supereffective|')) {
      return { text: "It's super effective!", cls: 'text-orange-400 italic' };
    }
    if (line.startsWith('|-resisted|')) {
      return { text: "It's not very effective...", cls: 'text-gray-400 italic' };
    }
    if (line.startsWith('|-crit|')) {
      return { text: 'A critical hit!', cls: 'text-yellow-300 italic' };
    }
    if (line.startsWith('|-miss|')) {
      const parts = line.split('|');
      return { text: `${parts[2]}'s attack missed!`, cls: 'text-gray-500' };
    }
    if (line.startsWith('|-immune|')) {
      const parts = line.split('|');
      return { text: `It doesn't affect ${parts[2]}...`, cls: 'text-gray-500 italic' };
    }
    if (line.startsWith('|-status|')) {
      const parts = line.split('|');
      const statusMap: Record<string, string> = { brn: 'burned', par: 'paralyzed', slp: 'fell asleep', psn: 'poisoned', tox: 'badly poisoned', frz: 'frozen' };
      return { text: `${parts[2]} was ${statusMap[parts[3]] ?? parts[3]}!`, cls: 'text-purple-300' };
    }
    if (line.startsWith('|-boost|') || line.startsWith('|-unboost|')) {
      const parts = line.split('|');
      const up = line.startsWith('|-boost|');
      return { text: `${parts[2]}'s ${parts[3]} ${up ? 'rose' : 'fell'}!`, cls: up ? 'text-cyan-300' : 'text-orange-300' };
    }
    if (line.startsWith('|-ability|')) {
      const parts = line.split('|');
      return { text: `[${parts[2]}'s ${parts[3]}]`, cls: 'text-indigo-300 italic' };
    }
    if (line.startsWith('|-weather|')) {
      const parts = line.split('|');
      return { text: `The weather is ${parts[2]}!`, cls: 'text-sky-300' };
    }
    if (line.startsWith('|')) {
      // Skip uninteresting protocol lines
      return { text: '', cls: '' };
    }
    // Plain text messages
    return { text: line, cls: 'text-[var(--text-muted)]' };
  }
</script>

<div class="bg-[var(--bg-secondary)] rounded-xl p-4 h-full flex flex-col">
  <h3 class="text-sm font-semibold text-[var(--text-muted)] mb-3">Battle Log</h3>
  <div
    bind:this={logContainer}
    class="flex-1 overflow-y-auto space-y-0.5 max-h-[60vh] text-sm font-mono pr-2"
  >
    {#if logs.length === 0}
      <p class="text-[var(--text-muted)] text-center py-4">Waiting for battle to start...</p>
    {:else}
      {#each logs as line}
        {@const formatted = formatLine(line)}
        {#if formatted.text}
          <div class="{formatted.cls} py-0.5">{formatted.text}</div>
        {/if}
      {/each}
    {/if}
  </div>
</div>
