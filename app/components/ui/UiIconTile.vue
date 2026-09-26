<script setup lang="ts">
import type { Component } from 'vue'

/**
 * An icon in a soft raised tile - category icons, quick actions, list
 * leaders. `tint` is a category token (cat-1..12): category colour is
 * IDENTITY and lives only in these tiles, never on amounts.
 */
interface Props { icon: Component; tint?: string | null; size?: 'sm' | 'md' | 'lg' }
const props = withDefaults(defineProps<Props>(), { tint: null, size: 'md' })

const px = computed(() => ({ sm: 16, md: 19, lg: 24 }[props.size]))
const style = computed(() =>
  props.tint ? { background: `var(--vv-${props.tint})`, color: `var(--vv-${props.tint}-fg)` } : {},
)
</script>

<template>
  <span class="tile neu" :class="size" :style="style" aria-hidden="true">
    <component :is="icon" :size="px" />
  </span>
</template>

<style scoped>
.tile { display: grid; place-items: center; flex: none; color: var(--vv-muted); border-radius: var(--vv-r-sm); }
.sm { width: 32px; height: 32px; border-radius: var(--vv-r-badge); }
.md { width: 42px; height: 42px; }
.lg { width: 56px; height: 56px; }
</style>
