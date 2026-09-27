<script setup lang="ts">
import { Copy, Check } from 'lucide-vue-next'

/**
 * A value to paste somewhere else (a URL, a key) with a Copy button - so it
 * never has to be retyped on a phone keyboard, where one wrong character
 * breaks the whole setup.
 */
const props = defineProps<{ value: string }>()
const { t } = useI18n()
const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

async function copy() {
  try {
    await navigator.clipboard.writeText(props.value)
    copied.value = true
    clearTimeout(timer)
    timer = setTimeout(() => (copied.value = false), 1800)
  } catch {
    // Clipboard blocked (rare): the text is selectable, so long-press works.
  }
}
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="copy">
    <code>{{ value }}</code>
    <button type="button" class="btn" :class="{ done: copied }" @click="copy">
      <component :is="copied ? Check : Copy" :size="15" aria-hidden="true" />
      <span aria-live="polite">{{ copied ? t('you.copied') : t('you.copy') }}</span>
    </button>
  </div>
</template>

<style scoped>
.copy {
  display: flex; align-items: center; gap: 10px; margin: 8px 0 4px;
  padding: 8px 8px 8px 14px; border-radius: var(--vv-r-sm); box-shadow: var(--vv-p1);
}
code {
  flex: 1; min-width: 0; font-family: ui-monospace, 'SF Mono', monospace; font-size: 13px;
  color: var(--vv-text); word-break: break-all; user-select: all;
}
.btn {
  display: inline-flex; align-items: center; gap: 6px; flex: none;
  min-height: var(--vv-control-sm); padding: 0 12px;
  font: inherit; font-size: 13px; font-weight: 600; color: var(--vv-muted);
  background: var(--vv-surface); border: none; border-radius: var(--vv-r-badge);
  box-shadow: var(--vv-e1); cursor: pointer;
}
.btn:active { box-shadow: var(--vv-p1); }
.btn.done { color: var(--vv-accent); }
.btn:focus-visible { outline: 2px solid var(--vv-accent-ring); outline-offset: 2px; }
</style>
