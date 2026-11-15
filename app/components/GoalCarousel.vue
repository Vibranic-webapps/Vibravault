<script setup lang="ts">
import { Plus } from 'lucide-vue-next'
import type { Goal } from '~/stores/goals'

/**
 * Home's goals: small cards in a sideways carousel that bends. The card in the
 * middle faces you; the ones beside it tilt toward the centre, shrink and fade,
 * like a cupped hand. The goal's picture fills the whole card and everything
 * else sits on top of it: a progress ring, the name and saved-of-target on a
 * dark fade, and a round + that adds money without opening the card. A goal
 * without a picture shows its first letter on its pastel tint.
 *
 * `data-swipe-lock` keeps the screen swipe off this row: sideways here scrolls
 * the cards, not the pages. Touch scrolls natively; a mouse drags by hand. Only
 * transforms and opacity animate (cheap), and with reduced motion the cards stay flat.
 */
const props = defineProps<{ goals: Goal[] }>()
const emit = defineEmits<{ open: [id: string]; add: [id: string]; new: [] }>()

const { t } = useI18n()
const { money } = useFormat()

// A link that no longer loads: the card falls back to dark-on-tint text.
const broken = reactive(new Set<string>())
const pictured = (g: Goal) => !!g.imageSrc && !broken.has(g.id)
const pct = (g: Goal) => Math.min(100, Math.max(0, Math.round(g.percent)))

const track = ref<HTMLElement | null>(null)
const TILT = 24 // degrees of turn per card-width away from the centre
const DEPTH = 46 // px pushed back per card-width away from the centre

let frame = 0
function bend() {
  frame = 0
  const el = track.value
  if (!el) return
  const mid = el.scrollLeft + el.clientWidth / 2
  for (const slide of Array.from(el.children) as HTMLElement[]) {
    const away = Math.max(-2, Math.min(2, (slide.offsetLeft + slide.offsetWidth / 2 - mid) / slide.offsetWidth))
    const far = Math.abs(away)
    slide.style.transform = `translateZ(${-far * DEPTH}px) rotateY(${away * TILT}deg) scale(${1 - far * 0.08})`
    slide.style.opacity = String(1 - far * 0.28)
  }
}
function schedule() {
  if (!frame) frame = requestAnimationFrame(bend)
}

let reduced = false
onMounted(() => {
  reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) return
  bend()
  window.addEventListener('resize', schedule)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', schedule)
  if (frame) cancelAnimationFrame(frame)
})
// A goal added or removed changes the row: bend again once it is rendered.
watch(() => props.goals.length, () => nextTick(() => { if (!reduced) bend() }))
function onScroll() {
  if (!reduced) schedule()
}

// --- Mouse drag ------------------------------------------------------------
// Touch scrolls a native scroller by itself; a mouse does not. So with a mouse
// we drag the row by hand, then glide to the nearest card.
const dragging = ref(false)
let startX = 0
let startScroll = 0
let moved = 0
let pointer = -1

function onPointerDown(e: PointerEvent) {
  moved = 0 // every press starts clean, so a mouse drag can't swallow a later tap
  if (e.pointerType !== 'mouse' || e.button !== 0 || !track.value) return
  pointer = e.pointerId
  startX = e.clientX
  startScroll = track.value.scrollLeft
}
function onPointerMove(e: PointerEvent) {
  const el = track.value
  if (e.pointerId !== pointer || !el) return
  moved = e.clientX - startX
  if (!dragging.value && Math.abs(moved) < 6) return // a click, not a drag
  if (!dragging.value) {
    dragging.value = true // snapping off while dragging, or the row fights the hand
    el.setPointerCapture(e.pointerId)
  }
  el.scrollLeft = startScroll - moved
}
function onPointerUp(e: PointerEvent) {
  const el = track.value
  if (e.pointerId !== pointer || !el) return
  pointer = -1
  if (!dragging.value) return
  el.releasePointerCapture(e.pointerId)
  const mid = el.scrollLeft + el.clientWidth / 2
  let best: HTMLElement | null = null
  let gap = Infinity
  for (const slide of Array.from(el.children) as HTMLElement[]) {
    const d = Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - mid)
    if (d < gap) { gap = d; best = slide }
  }
  dragging.value = false // snapping back on
  if (best) el.scrollTo({ left: best.offsetLeft + best.offsetWidth / 2 - el.clientWidth / 2, behavior: reduced ? 'auto' : 'smooth' })
}
// The mouse-up after a drag must not count as a click on the card under it.
function onClickCapture(e: MouseEvent) {
  if (Math.abs(moved) >= 6) { e.stopPropagation(); e.preventDefault(); moved = 0 }
}
</script>

<template>
  <div
    ref="track"
    class="track"
    :class="{ dragging }"
    role="group"
    aria-roledescription="carousel"
    :aria-label="t('goals.title')"
    data-swipe-lock
    @scroll.passive="onScroll"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @click.capture="onClickCapture"
  >
    <div v-for="g in goals" :key="g.id" class="slide">
      <div
        class="neu-3 gcard"
        :class="{ pictured: pictured(g) }"
        :style="goalTintStyle(goalTint(g))"
      >
        <button type="button" class="open" :aria-label="t('goals.openN', { name: g.name })" @click="emit('open', g.id)">
          <span class="stage">
            <GoalPicture :src="g.imageSrc" :name="g.name" fit="cover" :focus-x="g.imageFocusX" :focus-y="g.imageFocusY" :zoom="g.imageZoom" @broken="broken.add(g.id)" />
          </span>
          <span class="name">{{ g.name }}</span>
        </button>
        <div class="meter">
          <span
            class="bar"
            role="progressbar"
            :aria-label="t('goals.progressLabel', { name: g.name })"
            :aria-valuenow="pct(g)"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <span class="fill" :style="{ width: `${pct(g)}%` }" />
          </span>
          <span class="pct" aria-hidden="true">{{ pct(g) }}%</span>
        </div>
        <div class="foot">
          <span class="amounts">
            <strong>{{ money(g.savedCents) }}</strong>
            <small>{{ t('goals.of', { target: money(g.targetCents) }) }}</small>
          </span>
          <UiIconButton :icon="Plus" :label="t('goals.addTo', { name: g.name })" @click="emit('add', g.id)" />
        </div>
      </div>
    </div>

    <div class="slide">
      <button type="button" class="neu-3 gcard newcard" @click="emit('new')">
        <span class="plus" aria-hidden="true"><Plus :size="22" /></span>
        <span class="name">{{ t('goals.new') }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Full-bleed past the screen padding, with room for shadows (a scroller clips them).
   The side padding lets the first and last card reach the centre. */
.track {
  --w: 192px; --h: 212px; --bleed: 24px;
  display: flex; gap: 14px; overflow-x: auto; scrollbar-width: none;
  scroll-snap-type: x mandatory; overscroll-behavior-x: contain;
  perspective: 720px; /* one shared vanishing point: the middle of the row */
  margin: 0 calc(-1 * var(--bleed)); padding: 22px calc(50% - var(--w) / 2) 30px;
}
.track::-webkit-scrollbar { display: none; }
@media (hover: hover) { .track { cursor: grab; } }
.track.dragging { cursor: grabbing; scroll-snap-type: none; user-select: none; }
.track.dragging .gcard { pointer-events: none; }
.slide { flex: 0 0 var(--w); scroll-snap-align: center; will-change: transform, opacity; }

.gcard {
  position: relative; display: flex; flex-direction: column; gap: 8px;
  --edge: 10px; /* gap between the floating controls and the card's edge */
  width: 100%; height: var(--h); padding: 12px; overflow: hidden;
  font: inherit; color: var(--vv-text); text-align: left; border: none;
}
.open {
  display: flex; flex-direction: column; flex: 1; min-height: 0; gap: 8px; padding: 0;
  font: inherit; color: inherit; text-align: left; background: none; border: none; border-radius: var(--vv-r-sm);
  cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.open:focus-visible { outline: 2px solid var(--vv-accent-ring); outline-offset: 2px; }
.name { max-width: 100%; font-size: 15px; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Progress: a slim bar above the amounts with the percentage at its end (one line). The bar is white on
   the dark fade (always readable) and the tint's ink on a pastel ground, so it can't vanish on any picture or colour. */
.meter { position: absolute; left: 12px; right: var(--edge); bottom: 58px; z-index: 1; display: flex; align-items: center; gap: 8px; pointer-events: none; }
.bar { flex: 1; height: 6px; border-radius: 999px; background: color-mix(in srgb, var(--g-ink) 20%, transparent); overflow: hidden; }
.fill { display: block; height: 100%; border-radius: 999px; background: var(--g-ink); transition: width .6s cubic-bezier(.22, 1, .36, 1); }
.pct { flex: none; font-size: 12px; font-weight: 800; white-space: nowrap; font-variant-numeric: tabular-nums; color: var(--g-ink); }
.pictured .bar { background: rgba(255, 255, 255, .3); }
.pictured .fill { background: var(--vv-on-scrim); }
.pictured .pct { color: var(--vv-on-scrim); text-shadow: 0 1px 3px rgba(0, 0, 0, .55); }
/* Glass, not a raised disc: frosted, a hairline edge and no shadow (no glow). */
.foot :deep(.ib) {
  background: var(--vv-glass-tint); border: 1px solid var(--vv-glass-line); box-shadow: none;
  border-radius: calc(var(--vv-r-lg) - var(--edge));
  -webkit-backdrop-filter: var(--vv-glass-blur); backdrop-filter: var(--vv-glass-blur);
}
.pictured .foot :deep(.ib) { background: var(--vv-glass-photo); color: var(--vv-on-scrim); }
.foot :deep(.ib) { color: var(--g-ink); }
.foot :deep(.ib:hover) { color: var(--g-ink); }
.pictured .foot :deep(.ib:hover) { color: var(--vv-on-scrim); }
.foot :deep(.ib:active) { box-shadow: none; transform: scale(.94); color: var(--g-ink); }
.pictured .foot :deep(.ib:active) { color: var(--vv-on-scrim); }

.foot { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.amounts { display: flex; flex-direction: column; min-width: 0; font-variant-numeric: tabular-nums; }
.amounts strong { font-size: 15px; font-weight: 800; white-space: nowrap; }
.amounts small { font-size: 12px; color: var(--vv-muted); white-space: nowrap; }

/* The picture is the card; text rides on a dark fade at the bottom. */
.gcard:not(.newcard) { padding: 0; }
.gcard:not(.newcard) .open { position: absolute; inset: 0; gap: 0; border-radius: inherit; }
.stage { position: absolute; inset: 0; background: var(--g-bg); }
.name { position: absolute; left: 12px; right: 12px; bottom: 82px; z-index: 1; }
.newcard .name { position: static; }
.gcard:not(.newcard) .foot { position: absolute; left: 0; right: 0; bottom: 0; padding: 0 var(--edge) var(--edge) 12px; }
.pictured .stage::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 72%; background: var(--vv-scrim); }
.pictured .name,
.pictured .amounts strong,
.pictured .amounts small { color: var(--vv-on-scrim); text-shadow: 0 1px 3px rgba(0, 0, 0, .55); }
.pictured .amounts small { opacity: .92; }
.gcard:not(.pictured):not(.newcard) .name { color: var(--g-ink); }

.newcard { align-items: center; justify-content: center; gap: 10px; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.newcard:active { box-shadow: var(--vv-p3); }
.newcard:focus-visible { outline: 2px solid var(--vv-accent-ring); outline-offset: 3px; }
.plus { display: grid; place-items: center; width: 48px; height: 48px; border-radius: var(--vv-r-md); box-shadow: var(--vv-p1); color: var(--vv-goal); }

@media (max-width: 560px) { .track { --bleed: 18px; } }
@media (prefers-reduced-motion: reduce) { .slide { will-change: auto; } .fill { transition: none; } }
</style>
