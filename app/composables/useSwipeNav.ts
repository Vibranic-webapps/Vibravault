import type { Ref } from 'vue'

/**
 * The four main screens, in the order the bottom bar shows them. Swiping and
 * the slide direction of the page transition both read this one list, so
 * they can never disagree about what is "left" and "right".
 */
export const MAIN_TABS = ['/', '/transactions', '/categories', '/you'] as const

export function tabIndex(path: string): number {
  return (MAIN_TABS as readonly string[]).indexOf(path)
}

// Tuned for "clearly sideways, on purpose":
const MIN_DISTANCE = 70   // px - shorter is a wobble, not a swipe
const MAX_DURATION = 600  // ms - slower is a drag/read, not a swipe
const DOMINANCE = 2       // sideways must beat up/down by 2x, so scrolling never counts
const EDGE = 24           // px - iOS uses the screen edge for "back"; leave it alone

/**
 * Is this finger movement a deliberate sideways swipe? -1 = finger moved left
 * (content goes left, the NEXT thing comes in), 1 = finger moved right, 0 = no.
 * The page swipe and the month swipe both ask here, so they feel identical.
 */
export function swipeDirection(dx: number, dy: number, dt: number): -1 | 0 | 1 {
  if (dt > MAX_DURATION) return 0
  if (Math.abs(dx) < MIN_DISTANCE) return 0
  if (Math.abs(dx) < Math.abs(dy) * DOMINANCE) return 0
  return dx < 0 ? -1 : 1
}

/**
 * Swipe left/right between the main screens (#8).
 *
 * A swipe is ignored when it starts on something that owns its own sideways
 * movement: a form control, anything that scrolls horizontally (filter chips),
 * or an element marked `data-swipe-lock` (the bank-card carousel, the Home month
 * section - which runs its own swipe via useSwipeZone).
 * Listeners are passive - we only READ the gesture, never block scrolling.
 */
export function useSwipeNav(target: Ref<HTMLElement | null>) {
  const route = useRoute()
  const router = useRouter()
  let start: { x: number; y: number; t: number } | null = null

  function ownsSideways(from: EventTarget | null): boolean {
    let node = from instanceof HTMLElement ? from : null
    while (node && node !== target.value) {
      if (node.dataset.swipeLock !== undefined) return true
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(node.tagName)) return true
      const ox = getComputedStyle(node).overflowX
      if ((ox === 'auto' || ox === 'scroll') && node.scrollWidth > node.clientWidth) return true
      node = node.parentElement
    }
    return false
  }

  function onStart(e: TouchEvent) {
    const touch = e.touches[0]
    start = null
    if (e.touches.length !== 1 || !touch) return
    if (touch.clientX < EDGE || touch.clientX > window.innerWidth - EDGE) return
    if (ownsSideways(e.target)) return
    start = { x: touch.clientX, y: touch.clientY, t: Date.now() }
  }

  function onEnd(e: TouchEvent) {
    const touch = e.changedTouches[0]
    if (!start || !touch) return
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    const dt = Date.now() - start.t
    start = null

    const dir = swipeDirection(dx, dy, dt)
    if (!dir) return

    const i = tabIndex(route.path)
    if (i < 0) return
    // Finger moves LEFT -> content moves left -> the NEXT screen comes in.
    const next = MAIN_TABS[i - dir]
    if (next) router.push(next)
  }

  function onCancel() { start = null }

  onMounted(() => {
    const el = target.value
    if (!el) return
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onCancel, { passive: true })
  })
  onBeforeUnmount(() => {
    const el = target.value
    if (!el) return
    el.removeEventListener('touchstart', onStart)
    el.removeEventListener('touchend', onEnd)
    el.removeEventListener('touchcancel', onCancel)
  })
}

/**
 * A swipe zone: a region that keeps sideways swipes for itself. Mark the same
 * element `data-swipe-lock` so the screen swipe above leaves it alone; a swipe
 * that starts inside calls `onSwipe('next' | 'prev')` instead of changing page.
 * Home uses it so the month section swipes between months.
 */
export function useSwipeZone(target: Ref<HTMLElement | null>, onSwipe: (dir: 'next' | 'prev') => void) {
  let start: { x: number; y: number; t: number } | null = null

  function onStart(e: TouchEvent) {
    const touch = e.touches[0]
    start = null
    if (e.touches.length !== 1 || !touch) return
    if (touch.clientX < EDGE || touch.clientX > window.innerWidth - EDGE) return
    start = { x: touch.clientX, y: touch.clientY, t: Date.now() }
  }
  function onEnd(e: TouchEvent) {
    const touch = e.changedTouches[0]
    if (!start || !touch) return
    const dir = swipeDirection(touch.clientX - start.x, touch.clientY - start.y, Date.now() - start.t)
    start = null
    if (dir) onSwipe(dir < 0 ? 'next' : 'prev')
  }
  function onCancel() { start = null }

  onMounted(() => {
    const el = target.value
    if (!el) return
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onCancel, { passive: true })
  })
  onBeforeUnmount(() => {
    const el = target.value
    if (!el) return
    el.removeEventListener('touchstart', onStart)
    el.removeEventListener('touchend', onEnd)
    el.removeEventListener('touchcancel', onCancel)
  })
}
