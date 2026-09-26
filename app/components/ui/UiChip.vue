<script setup lang="ts">
/**
 * A toggle chip for filters (All / To sort / In / Out / Transfers). Unlike
 * UiSegmented, chips sit in a scrollable row and can carry a count.
 */
interface Props { active?: boolean; count?: number }
withDefaults(defineProps<Props>(), { active: false })
const emit = defineEmits<{ click: [] }>()
</script>

<template>
  <button type="button" class="chip" :class="{ on: active }" :aria-pressed="active" @click="emit('click')">
    <slot />
    <span v-if="count" class="count">{{ count }}</span>
  </button>
</template>

<style scoped>
.chip {
  display: inline-flex; align-items: center; gap: 7px; flex: none;
  min-height: var(--vv-control-sm); padding: 0 14px;
  font: inherit; font-size: 13px; font-weight: 600; white-space: nowrap;
  color: var(--vv-muted); background: var(--vv-surface);
  border: none; border-radius: var(--vv-r-badge); box-shadow: var(--vv-e1); cursor: pointer;
  transition: color .12s ease, box-shadow .12s ease;
}
.chip.on { color: var(--vv-accent); box-shadow: var(--vv-p1); }
.chip:focus-visible { outline: 2px solid var(--vv-accent-ring); outline-offset: 2px; }
.count {
  min-width: 20px; padding: 1px 6px; border-radius: 8px;
  font-size: 11px; font-weight: 700; color: var(--vv-accent-text); background: var(--vv-accent);
}
</style>
