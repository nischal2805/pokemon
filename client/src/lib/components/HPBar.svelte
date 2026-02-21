<script lang="ts">
  interface Props {
    percent: number;
    showText?: boolean;
    hpText?: string;
    size?: 'sm' | 'md' | 'lg';
  }
  let { percent, showText = false, hpText = '', size = 'sm' }: Props = $props();

  let barColor = $derived(
    percent > 50 ? 'from-green-400 to-green-600' :
    percent > 20 ? 'from-yellow-400 to-yellow-600' :
    'from-red-400 to-red-600'
  );

  let h = $derived(size === 'lg' ? 'h-4' : size === 'md' ? 'h-3' : 'h-2');
</script>

<div class="relative w-full {h} bg-gray-900/60 rounded-full overflow-hidden border border-gray-700/50"
  style="min-width: 60px;">
  <div
    class="h-full bg-gradient-to-r {barColor} rounded-full transition-all duration-700 ease-out"
    style="width: {Math.max(0, Math.min(100, percent))}%"
  ></div>
  {#if showText && (size === 'md' || size === 'lg')}
    <span class="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white drop-shadow-md">
      {hpText || `${Math.round(percent)}%`}
    </span>
  {/if}
</div>
