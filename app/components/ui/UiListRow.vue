<script setup lang="ts">
import type { Component } from 'vue'
import { ChevronRight } from 'lucide-vue-next'

/**
 * One row of a grouped list - the pattern for the "You" tab and anywhere a
 * list of places-to-go appears. A chevron means "this takes you somewhere".
 * Flat on purpose: rows live INSIDE a raised card, never raised themselves.
 */
interface Props {
  label: string
  icon?: Component
  value?: string
  to?: string
  hint?: string      // second, quieter line under the label
  danger?: boolean
  chevron?: boolean
  disabled?: boolean // shown but not tappable (e.g. "Soon")
}
const props = withDefaults(defineProps<Props>(), { danger: false, chevron: undefined, disabled: false })
const emit = defineEmits<{ click: [] }>()

const showChevron = computed(() => !props.disabled && (props.chevron ?? !!props.to))

// NuxtLink is auto-imported, not globally registered, so the string 'NuxtLink'
// in :is would NOT resolve - every link row would silently render as a plain
// <button>. resolveComponent hands over the real component.
const NuxtLinkComp = resolveComponent('NuxtLink')
const tag = computed(() => (props.to && !props.disabled ? NuxtLinkComp : 'button'))
</script>

<template>
  <component
    :is="tag"
    :to="disabled ? undefined : to"
    :type="to && !disabled ? undefined : 'button'"
    :disabled="disabled || undefined"
    class="row"
    :class="{ danger, disabled, 'has-hint': !!hint }"
    @click="!disabled && emit('click')"
  >
    <span v-if="icon" class="ic"><component :is="icon" :size="18" aria-hidden="true" /></span>
    <span class="lab">
      {{ label }}
      <small v-if="hint" class="hint">{{ hint }}</small>
    </span>
    <span v-if="value" class="val">{{ value }}</span>
    <ChevronRight v-if="showChevron" class="chev" :size="18" aria-hidden="true" />
  </component>
</template>

<style scoped>
.row {
  display: flex; align-items: center; gap: 14px; width: 100%;
  min-height: 52px; padding: 0 4px;
  font: inherit; text-align: left; text-decoration: none;
  color: var(--vv-text); background: none; border: none; cursor: pointer;
}
.row + .row { border-top: 1px solid var(--vv-shadow-dark); }
.ic { display: grid; place-items: center; width: 34px; height: 34px; flex: none;
  color: var(--vv-muted); border-radius: var(--vv-r-badge); box-shadow: var(--vv-e1); }
.lab { flex: 1; min-width: 0; font-size: 15px; font-weight: 600; }
.hint { display: block; margin-top: 2px; font-size: 13px; font-weight: 400; color: var(--vv-muted); }
.has-hint { min-height: 64px; padding-top: 8px; padding-bottom: 8px; }
.disabled { cursor: default; opacity: .55; }
.val { font-size: 14px; color: var(--vv-muted); }
.chev { color: var(--vv-muted-2); }
.danger, .danger .ic { color: var(--vv-negative); }
.row:focus-visible { outline: 2px solid var(--vv-accent-ring); outline-offset: 2px; border-radius: 8px; }
</style>
