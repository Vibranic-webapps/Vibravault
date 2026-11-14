<script setup lang="ts">
import { X } from 'lucide-vue-next'

/**
 * A sheet that slides up from the bottom - how phone apps show a focused
 * task (the Add sheet, and later the transaction drawer). Centred panel on
 * wider screens. Closes on the scrim, the X, Escape, or dragging it down.
 * Focus: moves in on open, is trapped inside, and returns to the opener on close.
 */
interface Props {
  modelValue: boolean
  title?: string
  /** Spoken name when there's no visible title. */
  label?: string
  /** Off when the content handles Escape itself (e.g. first cancel an edit). */
  closeOnEscape?: boolean
}
const props = withDefaults(defineProps<Props>(), { closeOnEscape: true })
const emit = defineEmits<{ 'update:modelValue': [open: boolean] }>()
const { t } = useI18n()

const sheet = ref<HTMLElement | null>(null)

function close() { emit('update:modelValue', false) }
function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && props.modelValue && props.closeOnEscape) close() }

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// --- Focus handling -----------------------------------------------------------
// Open: remember what had focus (the button that opened us), move focus into
// the sheet, and make the page behind inert. Close: undo both and hand focus
// back. Tab / Shift+Tab wrap inside the sheet (onSheetKey).
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const scrim = ref<HTMLElement | null>(null)
let opener: HTMLElement | null = null
let inerted: HTMLElement[] = []

function focusables(): HTMLElement[] {
  const root = sheet.value
  if (!root) return []
  // offsetParent === null = display:none, so it can't take focus.
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null)
}

function onSheetKey(e: KeyboardEvent) {
  if (e.key !== 'Tab') return
  const items = focusables()
  const first = items[0]
  const last = items[items.length - 1]
  if (!first || !last) { e.preventDefault(); sheet.value?.focus(); return }
  const active = document.activeElement
  if (e.shiftKey && (active === first || active === sheet.value)) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
}

// The page behind (and any sheet underneath this one) must not be reachable.
// Live regions (toasts) stay out of it so announcements still work.
// An element that CONTAINS a live region can't be made inert as a whole (inert content
// is not announced), so we go one level down and inert its other children instead.
// The app root holds the toaster and the pull-to-refresh live region, so without this
// descent nothing behind the sheet would ever be locked.
function lockTree(parent: Element, depth = 0) {
  for (const el of Array.from(parent.children)) {
    if (!(el instanceof HTMLElement) || el === scrim.value || el.hasAttribute('inert')) continue
    if (el.matches('script, style, [aria-live]')) continue
    if (el.querySelector('[aria-live]') && depth < 6) { lockTree(el, depth + 1); continue }
    el.setAttribute('inert', '')
    inerted.push(el)
  }
}
function lockBackground() { lockTree(document.body) }
function unlockBackground() {
  inerted.forEach((el) => el.removeAttribute('inert'))
  inerted = []
}

function release() {
  unlockBackground()
  const target = opener
  opener = null
  if (target && target.isConnected) { target.focus(); return }
  // The opener is gone (e.g. its row was just deleted): hand focus to the sheet still
  // open underneath, if any, so Tab can't drift into the page behind it.
  const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).filter((d) => d !== sheet.value && !d.closest('[inert]'))
  const under = dialogs[dialogs.length - 1]
  if (under) nextTick(() => { (Array.from(under.querySelectorAll<HTMLElement>(FOCUSABLE)).find((el) => el.offsetParent !== null) ?? under).focus() })
}

// flush 'pre': runs before the DOM updates, so activeElement is still the opener.
watch(() => props.modelValue, (open) => {
  if (open) {
    dragY.value = 0
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    nextTick(() => {
      lockBackground()
      ;(focusables()[0] ?? sheet.value)?.focus()
    })
  } else {
    release()
  }
})

onBeforeUnmount(() => { if (props.modelValue) release() })

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
      <div v-if="modelValue" ref="scrim" class="scrim" :style="scrimStyle" @click.self="close">
        <div
          ref="sheet"
          class="neu-4 sheet"
          :class="{ dragging }"
          :style="sheetStyle"
          role="dialog"
          aria-modal="true"
          :aria-label="title ?? label"
          tabindex="-1"
          @keydown="onSheetKey"
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
