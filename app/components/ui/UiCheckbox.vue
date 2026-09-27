<script setup lang="ts">
import { Check } from 'lucide-vue-next'

/**
 * A checkbox in the system's own language: unchecked is a HOLE (pressed in),
 * checked pops OUT and fills with the accent. A real <input type="checkbox">
 * underneath, so keyboard, label tap and screen readers all just work.
 * The slot is the label; <small> inside it renders as a quieter second line.
 */
defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <label class="check">
    <input
      type="checkbox"
      class="sr"
      :checked="modelValue"
      @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span class="box" aria-hidden="true"><Check v-if="modelValue" :size="15" :stroke-width="3" /></span>
    <span class="lab"><slot /></span>
  </label>
</template>

<style scoped>
.check { display: flex; align-items: flex-start; gap: 12px; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.sr { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.box {
  display: grid; place-items: center; width: 24px; height: 24px; flex: none;
  color: var(--vv-accent-text); background: var(--vv-surface);
  border-radius: 8px; box-shadow: var(--vv-p1); transition: background .14s ease, box-shadow .14s ease;
}
.sr:checked + .box { background: var(--vv-accent); box-shadow: var(--vv-e1); }
.sr:focus-visible + .box { outline: 2px solid var(--vv-accent-ring); outline-offset: 2px; }
.lab { padding-top: 2px; font-size: 14px; font-weight: 600; color: var(--vv-text); }
.lab :deep(small) { display: block; margin-top: 3px; font-size: 12px; font-weight: 400; color: var(--vv-muted); }
@media (prefers-reduced-motion: reduce) { .box { transition: none; } }
</style>
