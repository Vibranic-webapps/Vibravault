<script setup lang="ts">
import type { Component } from 'vue'

/**
 * Pick exactly one of a few options: money in / out, Day / Week / Month,
 * English / Nederlands. The chosen one is pressed IN.
 * A radio group underneath, so arrow keys and screen readers behave.
 */
interface Option { value: string; label: string; icon?: Component }
interface Props { modelValue: string; options: Option[]; label: string }
const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

function move(delta: number) {
  const i = props.options.findIndex((o) => o.value === props.modelValue)
  const next = props.options[(i + delta + props.options.length) % props.options.length]
  if (next) emit('update:modelValue', next.value)
}
</script>

<template>
  <div
    class="seg neu-pressed"
    role="radiogroup"
    :aria-label="label"
    @keydown.right.prevent="move(1)"
    @keydown.left.prevent="move(-1)"
  >
    <button
      v-for="o in options"
      :key="o.value"
      type="button"
      role="radio"
      class="opt"
      :class="{ on: modelValue === o.value }"
      :aria-checked="modelValue === o.value"
      :tabindex="modelValue === o.value ? 0 : -1"
      @click="emit('update:modelValue', o.value)"
    >
      <component :is="o.icon" v-if="o.icon" :size="16" aria-hidden="true" />
      {{ o.label }}
    </button>
  </div>
</template>

<style scoped>
.seg { display: flex; gap: 4px; padding: 4px; border-radius: var(--vv-r-sm); }
.opt {
  flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  min-height: 40px; padding: 0 12px;
  font: inherit; font-size: 14px; font-weight: 600; color: var(--vv-muted);
  background: none; border: none; border-radius: var(--vv-r-badge); cursor: pointer;
  transition: color .15s ease, box-shadow .15s ease, background .15s ease;
}
/* The chosen option pops OUT of the pressed-in track. */
.opt.on { color: var(--vv-accent); background: var(--vv-surface); box-shadow: var(--vv-e1); }
.opt:focus-visible { outline: 2px solid var(--vv-accent-ring); outline-offset: 1px; }
</style>
