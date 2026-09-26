<script setup lang="ts">
import type { Component } from 'vue'

/**
 * Buttons with words. Primary pops OUT in the accent; ghost is pure surface
 * (pure neumorphism); danger speaks coral. Pressing inverts the shadow -
 * the button sinks into the page.
 */
interface Props {
  variant?: 'primary' | 'ghost' | 'danger'
  icon?: Component
  loading?: boolean
  disabled?: boolean
  block?: boolean
  type?: 'button' | 'submit'
  to?: string
}
const props = withDefaults(defineProps<Props>(), {
  variant: 'primary', loading: false, disabled: false, block: true, type: 'button',
})
const emit = defineEmits<{ click: [e: MouseEvent] }>()
const { t } = useI18n()
</script>

<template>
  <NuxtLink v-if="to" :to="to" class="btn" :class="[variant, { block }]">
    <component :is="icon" v-if="icon" :size="18" aria-hidden="true" />
    <span><slot /></span>
  </NuxtLink>
  <button
    v-else
    :type="type"
    class="btn"
    :class="[variant, { block, loading }]"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    @click="emit('click', $event)"
  >
    <component :is="icon" v-if="icon && !loading" :size="18" aria-hidden="true" />
    <span>{{ loading ? t('common.loading') : '' }}<slot v-if="!loading" /></span>
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  min-height: var(--vv-control-lg); padding: 0 20px;
  font: inherit; font-size: 15px; font-weight: 700; text-decoration: none;
  border: none; border-radius: var(--vv-r-sm); cursor: pointer;
  transition: transform .12s ease, box-shadow .12s ease, filter .12s ease;
}
.btn.block { width: 100%; }
.btn.primary { color: var(--vv-accent-text); background: var(--vv-accent); box-shadow: var(--vv-e2); }
.btn.ghost   { color: var(--vv-text);        background: var(--vv-surface); box-shadow: var(--vv-e2); }
.btn.danger  { color: var(--vv-negative);    background: var(--vv-surface); box-shadow: var(--vv-e2); }
.btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.04); }
.btn:active:not(:disabled) { transform: translateY(1px); box-shadow: var(--vv-p2); }
.btn:disabled { opacity: .55; cursor: not-allowed; box-shadow: var(--vv-e1); }
.btn:focus-visible { outline: 2px solid var(--vv-accent-ring); outline-offset: 2px; }
</style>
