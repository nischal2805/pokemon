<script lang="ts">
  interface Props {
    percent: number;
  }
  let { percent }: Props = $props();

  let color = $derived(
    percent > 50 ? 'bg-green-500' :
    percent > 20 ? 'bg-yellow-500' :
    'bg-red-500'
  );
</script>

<div class="w-full h-2 bg-[var(--bg-card)] rounded-full overflow-hidden mt-1">
  <div class="{color} h-full transition-all duration-500 ease-out rounded-full" style="width: {Math.max(0, Math.min(100, percent))}%"></div>
</div>
