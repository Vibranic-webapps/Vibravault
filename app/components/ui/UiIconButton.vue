<script setup lang="ts">
import type { Component } from 'vue'

/**
 * Square icon-only button - header actions, month arrows, sheet close.
 * Every one is --vv-control in size, so they can't drift apart again (#5).
 * `label` is required: an icon-only button needs a spoken name.
 */
interface Props {
  icon: Component
  label: string
  size?: 'sm' | 'md'
  active?: boolean
  to?: string
}
const props = withDefaults(defineProps<Props>(), { size: 'md', active: false })
const emit = defineEmits<{ click: [e: MouseEvent] }>()

const px = computed(() => (props.size === 'sm' ? 16 : 19))
</script>

<template>
  <NuxtLink v-if="to" :to="to" class="ib" :class="[size, { active }]" :aria-label="label">
    <component :is="icon" :size="px" aria-hidden="true" />
  </NuxtLink>
  <button v-else type="button" class="ib" :class="[size, { active }]" :aria-label="label" @click="emit('click', $event)">
    <component :is="icon" :size="px" aria-hidden="true" />
  </button>
</template>

<style scoped>
.ib {
  width: var(--vv-control); height: var(--vv-control); flex: none;
  display: grid; place-items: center;
  color: var(--vv-muted); background: var(--vv-surface); text-decoration: none;
  border: none; border-radius: var(--vv-r-badge); box-shadow: var(--vv-e1);
  cursor: pointer; transition: box-shadow .12s ease, color .12s ease;
}
.ib.sm { width: var(--vv-control-sm); height: var(--vv-control-sm); }
.ib:hover { color: var(--vv-text); }
.ib:active, .ib.active { box-shadow: var(--vv-p1); color: var(--vv-accent); }
.ib:focus-visible { outline: 2px solid var(--vv-accent-ring); outline-offset: 2px; }
</style>
