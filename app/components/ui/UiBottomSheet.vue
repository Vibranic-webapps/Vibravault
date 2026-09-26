<script setup lang="ts">
import { X } from 'lucide-vue-next'

/**
 * A sheet that slides up from the bottom - how phone apps show a focused
 * task (the Add sheet, and later the transaction drawer). Centred panel on
 * wider screens. Closes on the scrim, the X, Escape, or dragging it down.
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
// users land where the action is. Also forget any leftover drag offset.
watch(() => props.modelValue, (open) => {
  if (open) {
    dragY.value = 0
    nextTick(() => sheet.value?.focus())
  }
})

// --- Drag down to close -----------------------------------------------------
// The sheet follows the finger downward. Let go past 30% of its height - or
// flick it quickly - and it closes; otherwise it springs back.
// Where can a drag start? The handle/title bar always. The content only
// while it's scrolled to the very top - otherwise the finger is SCROLLING.
const DISMISS_RATIO = 0.3
const FLICK_SPEED = 0.5 // px per ms
const SLOP = 8          // px of movement before we decide what the gesture is

const dragY = ref(0)
const dragging = ref(false)
let tracking = false
let startX = 0
let startY = 0
let startT = 0
let fromHandle = false

function onTouchStart(e: TouchEvent) {
  const touch = e.touches[0]
  tracking = e.touches.length === 1 && !!touch
  if (!touch) return
  startX = touch.clientX
  startY = touch.clientY
  startT = Date.now()
  fromHandle = !!(e.target as HTMLElement).closest?.('[data-drag-zone]')
  dragging.value = false
}

function onTouchMove(e: TouchEvent) {
  const touch = e.touches[0]
  if (!tracking || !touch) return
  const dy = touch.clientY - startY
  const dx = touch.clientX - startX

  if (!dragging.value) {
    if (Math.abs(dy) < SLOP && Math.abs(dx) < SLOP) return
    const downward = dy > 0 && Math.abs(dy) > Math.abs(dx)
    const atTop = (sheet.value?.scrollTop ?? 0) <= 0
    if (!downward || !(fromHandle || atTop)) { tracking = false; return }
    dragging.value = true
  }
  // We own this gesture now: stop the page / sheet from scrolling under it.
  if (e.cancelable) e.preventDefault()
  dragY.value = Math.max(0, dy)
}

function onTouchEnd() {
  tracking = false
  if (!dragging.value) return
  dragging.value = false

  const height = sheet.value?.offsetHeight ?? 1
  const speed = dragY.value / Math.max(1, Date.now() - startT)
  if (dragY.value > height * DISMISS_RATIO || speed > FLICK_SPEED) {
    dragY.value = height // slide the rest of the way out, then close
    setTimeout(close, 180)
  } else {
    dragY.value = 0 // spring back
  }
}

const sheetStyle = computed(() => (dragY.value ? { transform: `translateY(${dragY.value}px)` } : undefined))
// The dark backdrop lightens as the sheet is pulled away.
const scrimStyle = computed(() => {
  const h = sheet.value?.offsetHeight
  if (!dragY.value || !h) return undefined
  return { opacity: String(Math.max(0, 1 - dragY.value / h)) }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="modelValue" class="scrim" :style="scrimStyle" @click.self="close">
        <div
          ref="sheet"
          class="neu-4 sheet"
          :class="{ dragging }"
          :style="sheetStyle"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          tabindex="-1"
          @touchstart.passive="onTouchStart"
          @touchmove="onTouchMove"
          @touchend.passive="onTouchEnd"
          @touchcancel.passive="onTouchEnd"
        >
          <div class="drag-zone" data-drag-zone>
            <div class="grab" aria-hidden="true" />
            <header v-if="title" class="top">
              <h2>{{ title }}</h2>
              <UiIconButton :icon="X" :label="t('common.close')" size="sm" @click="close" />
            </header>
          </div>
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
  overscroll-behavior: contain;
  padding: 0 22px calc(24px + env(safe-area-inset-bottom));
  border-radius: var(--vv-r-lg) var(--vv-r-lg) 0 0;
  transition: transform .2s cubic-bezier(.22, 1, .36, 1);
}
/* While the finger is down the sheet follows it 1:1 - no easing lag. */
.sheet.dragging { transition: none; }

/* Handle + title = the grab area. Tall enough to hit with a thumb. */
.drag-zone { padding-top: 12px; touch-action: none; }
.grab { width: 38px; height: 5px; margin: 0 auto 14px; border-radius: 999px; background: var(--vv-shadow-dark); }
.top { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.top h2 { margin: 0; font-size: 19px; font-weight: 800; }

@media (min-width: 600px) {
  .scrim { align-items: center; padding: 24px; }
  .sheet { border-radius: var(--vv-r-lg); padding-bottom: 24px; }
  .grab { display: none; }
  .drag-zone { padding-top: 22px; touch-action: auto; }
}

.sheet-enter-active, .sheet-leave-active { transition: opacity .2s ease; }
.sheet-enter-active .sheet, .sheet-leave-active .sheet { transition: transform .26s cubic-bezier(.22, 1, .36, 1); }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
/* After a drag the inline transform wins, so the sheet leaves from where the
   finger let go instead of jumping back first. */
.sheet-enter-from .sheet, .sheet-leave-to .sheet { transform: translateY(16%); }
@media (prefers-reduced-motion: reduce) {
  .sheet, .sheet-enter-active, .sheet-leave-active,
  .sheet-enter-active .sheet, .sheet-leave-active .sheet { transition: none; }
}
</style>
