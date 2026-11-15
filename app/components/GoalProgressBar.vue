<script setup lang="ts">
/**
 * A goal's progress: a pressed-in track with a fill. The fill uses the goal token (--vv-goal, amber)
 * token on purpose - teal means income and coral means spending, and saving
 * is neither. Announces itself as a progressbar with its percent.
 */
defineProps<{ percent: number; label: string }>()
</script>

<template>
  <div
    class="track"
    role="progressbar"
    :aria-label="label"
    :aria-valuenow="percent"
    aria-valuemin="0"
    aria-valuemax="100"
  >
    <!-- 0% = no fill at all; the pressed track alone shows where it starts. -->
    <div class="fill" :class="{ empty: percent <= 0 }" :style="{ width: `${Math.max(percent, 0)}%` }" />
  </div>
</template>

<style scoped>
.track { height: 10px; border-radius: 999px; box-shadow: var(--vv-p1); overflow: hidden; }
.fill {
  height: 100%; border-radius: 999px; background: var(--g-ink, var(--vv-goal));
  transition: width .5s cubic-bezier(.22, 1, .36, 1);
}
.fill.empty { visibility: hidden; }
@media (prefers-reduced-motion: reduce) { .fill { transition: none; } }
</style>
