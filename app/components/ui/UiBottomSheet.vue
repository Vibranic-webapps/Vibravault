<script setup lang="ts">
import { X } from 'lucide-vue-next'

/**
 * A sheet that slides up from the bottom - how phone apps show a focused
 * task (the Add sheet, and later the transaction drawer). Centred panel on
 * wider screens. Closes on the scrim, the X, or Escape.
 */
interface Props { modelValue: boolean; title?: string }
const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [open: boolean] }>()
const { t } = useI18n()

const sheet = ref<HTMLElement | null>(null)

function close() { emit('update:modelValue', false) }
function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && props.modelValue) close() }

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// Move focus into the sheet when it opens, so keyboard and screen-reader
// users land where the action is.
watch(() => props.modelValue, (open) => {
  if (open) nextTick(() => sheet.value?.focus())
})
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="modelValue" class="scrim" @click.self="close">
        <div
          ref="sheet"
          class="neu-4 sheet"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          tabindex="-1"
        >
          <div class="grab" aria-hidden="true" />
          <header v-if="title" class="top">
            <h2>{{ title }}</h2>
            <UiIconButton :icon="X" :label="t('common.close')" size="sm" @click="close" />
          </header>
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.scrim {
  position: fixed; inset: 0; z-index: 50;
  display: flex; align-items: flex-end; justify-content: center;
  background: rgba(0, 0, 0, .38); backdrop-filter: blur(2px);
}
.sheet {
  width: 100%; max-width: 480px; max-height: 88dvh; overflow-y: auto; outline: none;
  padding: 12px 22px calc(24px + env(safe-area-inset-bottom));
  border-radius: var(--vv-r-lg) var(--vv-r-lg) 0 0;
}
@media (min-width: 600px) {
  .scrim { align-items: center; padding: 24px; }
  .sheet { border-radius: var(--vv-r-lg); padding-bottom: 24px; }
  .grab { display: none; }
}
.grab { width: 38px; height: 4px; margin: 0 auto 14px; border-radius: 999px; background: var(--vv-shadow-dark); }
.top { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.top h2 { margin: 0; font-size: 19px; font-weight: 800; }

.sheet-enter-active, .sheet-leave-active { transition: opacity .2s ease; }
.sheet-enter-active .sheet, .sheet-leave-active .sheet { transition: transform .26s cubic-bezier(.22, 1, .36, 1); }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-from .sheet, .sheet-leave-to .sheet { transform: translateY(16%); }
@media (prefers-reduced-motion: reduce) {
  .sheet-enter-active, .sheet-leave-active,
  .sheet-enter-active .sheet, .sheet-leave-active .sheet { transition: none; }
}
</style>
