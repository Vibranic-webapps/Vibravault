<script setup lang="ts">
/**
 * Pull-to-refresh for the main screens. A home-screen app has no browser refresh, so
 * dragging down at the top of the page does it here: the page follows the finger, a strip
 * of soft recessed tiles fills with the accent as you pull, and at the threshold it is
 * full. Let go and the tiles pulse in a wave while the page's handler refetches data.
 * The app itself is never reloaded.
 *
 * Touch only. The gesture starts only when the page is scrolled to the very top, the
 * finger moves mostly downward, and nothing modal is open, so normal scrolling, sideways
 * swiping between screens and sheets are untouched. Without a `refresh` handler it does
 * nothing at all. The transform is only applied while pulling: a permanent one would
 * break position:fixed (sheets, the bottom bar) inside the page.
 */
import type { PullRefreshHandler } from '~/composables/usePullRefresh'

const props = defineProps<{ refresh: PullRefreshHandler | null }>()

const { t } = useI18n()

// --- Feel (px / ms). Distances are the page's travel, not the finger's. ----------------
const SEGMENTS = 12
const RESISTANCE = 0.7 // the page moves 70% of the finger's distance until the threshold
const THRESHOLD = 64 // travel at which letting go refreshes
const OVERSHOOT_DAMPING = 0.3 // past the threshold it gets heavier
const MAX_TRAVEL = 96
const HOLD_TRAVEL = 56 // where the page rests while refreshing
const MIN_REFRESH_MS = 700 // a fast answer would flash by; show the wave at least this long
const DONE_HOLD_MS = 350 // the full strip stays a moment so "done" registers
const START_SLOP = 8 // the finger must move this far before we decide pull vs scroll

type Phase = 'idle' | 'pulling' | 'armed' | 'refreshing' | 'done' | 'failed'
const phase = ref<Phase>('idle')
const travel = ref(0)
const dragging = ref(false)

const root = ref<HTMLElement | null>(null)

let startX = 0
let startY = 0
let tracking = false
let pulling = false

const filled = computed(() => {
  if (phase.value === 'refreshing' || phase.value === 'armed' || phase.value === 'done') return SEGMENTS
  return Math.round(Math.min(1, travel.value / THRESHOLD) * SEGMENTS)
})

const caption = computed(() => {
  switch (phase.value) {
    case 'armed':
      return t('pull.release')
    case 'refreshing':
      return t('pull.refreshing')
    case 'done':
      return t('pull.updated')
    case 'failed':
      return t('pull.failed')
    default:
      return t('pull.pull')
  }
})

/** What a screen reader hears. Pulling and armed are visual only. */
const announcement = computed(() =>
  phase.value === 'refreshing' || phase.value === 'done' || phase.value === 'failed' ? caption.value : ''
)

/** Page travel for a finger distance: linear, then heavier past the threshold, then capped. */
function travelFor(dy: number): number {
  const raw = dy * RESISTANCE
  if (raw <= THRESHOLD) return raw
  return Math.min(MAX_TRAVEL, THRESHOLD + (raw - THRESHOLD) * OVERSHOOT_DAMPING)
}

function atTop(): boolean {
  return (document.scrollingElement?.scrollTop ?? window.scrollY) <= 0
}

/** True when the touch began inside something that scrolls on its own and isn't at its top. */
function insideScrolledContainer(target: EventTarget | null): boolean {
  let node = target instanceof Element ? target : null
  while (node && node !== root.value) {
    if (node.scrollTop > 0 && node.scrollHeight > node.clientHeight) {
      const overflowY = getComputedStyle(node).overflowY
      if (overflowY === 'auto' || overflowY === 'scroll') return true
    }
    node = node.parentElement
  }
  return false
}

function onTouchStart(e: TouchEvent) {
  tracking = false
  pulling = false
  if (!props.refresh || phase.value !== 'idle' || e.touches.length !== 1) return
  if (!atTop() || insideScrolledContainer(e.target)) return
  // A sheet or dialog is open: its own gestures win.
  if (document.querySelector('[aria-modal="true"], dialog[open]')) return
  const touch = e.touches[0]!
  startX = touch.clientX
  startY = touch.clientY
  tracking = true
}

function onTouchMove(e: TouchEvent) {
  if (!tracking) return
  const touch = e.touches[0]!
  const dy = touch.clientY - startY
  const dx = touch.clientX - startX

  if (!pulling) {
    // Not decided yet: upward or sideways means this is a normal scroll or a swipe between screens.
    if (dy < -START_SLOP || Math.abs(dx) > START_SLOP) {
      tracking = false
      return
    }
    if (dy < START_SLOP || !atTop()) return
    pulling = true
    dragging.value = true
    phase.value = 'pulling'
  }

  // Take over from the browser's own overscroll bounce.
  if (e.cancelable) e.preventDefault()
  travel.value = travelFor(Math.max(0, dy - START_SLOP))
  phase.value = travel.value >= THRESHOLD ? 'armed' : 'pulling'
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function onTouchEnd() {
  const wasPulling = pulling
  tracking = false
  pulling = false
  if (!wasPulling) return
  dragging.value = false

  if (phase.value !== 'armed' || !props.refresh) {
    phase.value = 'idle'
    travel.value = 0
    return
  }

  phase.value = 'refreshing'
  travel.value = HOLD_TRAVEL
  let ok = true
  try {
    await Promise.all([props.refresh(), wait(MIN_REFRESH_MS)])
  } catch {
    ok = false
  }
  phase.value = ok ? 'done' : 'failed'
  await wait(ok ? DONE_HOLD_MS : DONE_HOLD_MS * 2)
  phase.value = 'idle'
  travel.value = 0
}

function onTouchCancel() {
  if (phase.value === 'pulling' || phase.value === 'armed') {
    phase.value = 'idle'
    travel.value = 0
  }
  dragging.value = false
  tracking = false
  pulling = false
}

onMounted(() => {
  const el = root.value
  if (!el) return
  el.addEventListener('touchstart', onTouchStart, { passive: true })
  // Not passive: we must be able to cancel the browser's own bounce while pulling.
  el.addEventListener('touchmove', onTouchMove, { passive: false })
  el.addEventListener('touchend', onTouchEnd, { passive: true })
  el.addEventListener('touchcancel', onTouchCancel, { passive: true })
})

onBeforeUnmount(() => {
  const el = root.value
  if (!el) return
  el.removeEventListener('touchstart', onTouchStart)
  el.removeEventListener('touchmove', onTouchMove)
  el.removeEventListener('touchend', onTouchEnd)
  el.removeEventListener('touchcancel', onTouchCancel)
})
</script>

<template>
  <div ref="root" class="ptr">
    <div class="ptr-gap" aria-hidden="true" :style="{ height: `${travel}px` }" :data-phase="phase">
      <div class="ptr-inner">
        <span class="ptr-caption">{{ caption }}</span>
        <div class="ptr-segments" :class="{ sweep: phase === 'refreshing' }">
          <span
            v-for="n in SEGMENTS"
            :key="n"
            class="ptr-seg"
            :class="{ on: n <= filled }"
            :style="{ '--i': n }"
          />
        </div>
      </div>
    </div>
    <p class="ptr-live" role="status" aria-live="polite">{{ announcement }}</p>
    <div
      class="ptr-content"
      :class="{ drag: dragging }"
      :style="travel > 0 ? { transform: `translateY(${travel}px)` } : undefined"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped>
.ptr {
  position: relative;
}

/* The space the page leaves behind as it moves down. Above the page, never takes touches. */
.ptr-gap {
  position: fixed;
  top: env(safe-area-inset-top);
  left: 0;
  right: 0;
  z-index: 15;
  overflow: hidden;
  pointer-events: none;
  transition: height 0.25s ease;
}

/* While the finger is down the gap follows it 1:1 (no easing lag). */
.ptr-gap[data-phase='pulling'],
.ptr-gap[data-phase='armed'] {
  transition: none;
}

/* Anchored to the bottom of the gap, tiles lowest: they are the first thing the pull
   uncovers (the caption is secondary and arrives with the rest of the room). */
.ptr-inner {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding-bottom: 10px;
}

.ptr-segments {
  display: flex;
  gap: 4px;
}

/* An empty tile is pressed into the surface, a full one is the accent: the neumorphic
   "button pressed in / lit up" language, no raw shadows. */
.ptr-seg {
  display: block;
  width: 16px;
  height: 12px;
  border-radius: var(--vv-r-badge);
  background: var(--vv-surface);
  box-shadow: var(--vv-p1);
  transition: background-color 0.1s linear;
}

.ptr-seg.on {
  background: var(--vv-accent);
  box-shadow: none;
}

/* Refreshing: a wave of dimmer tiles runs left to right. */
.ptr-segments.sweep .ptr-seg {
  animation: ptr-wave 0.9s ease infinite;
  animation-delay: calc(var(--i) * 45ms);
}

@keyframes ptr-wave {
  0%,
  60%,
  100% {
    opacity: 1;
  }
  30% {
    opacity: 0.25;
  }
}

.ptr-caption {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--vv-muted);
}

.ptr-gap[data-phase='armed'] .ptr-caption,
.ptr-gap[data-phase='refreshing'] .ptr-caption {
  color: var(--vv-text);
}

.ptr-content {
  transition: transform 0.25s ease;
}

.ptr-content.drag {
  transition: none;
}

.ptr-live {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

@media (prefers-reduced-motion: reduce) {
  .ptr-segments.sweep .ptr-seg {
    animation: none;
  }
}
</style>
