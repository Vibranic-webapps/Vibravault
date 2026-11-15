<script setup lang="ts">
import { Plus } from 'lucide-vue-next'
import type { Goal } from '~/stores/goals'

/**
 * Home's goals: small cards in a sideways carousel that bends. The card in the
 * middle faces you; the ones beside it tilt toward the centre, shrink and fade,
 * like a cupped hand. Each card shows a progress ring, saved of target, and a
 * round + that adds money without opening the card.
 *
 * `data-swipe-lock` keeps the screen swipe off this row: sideways here scrolls
 * the cards, not the pages. Only transforms and opacity animate (cheap), and
 * with reduced motion the cards stay flat.
 */
const props = defineProps<{ goals: Goal[] }>()
const emit = defineEmits<{ open: [id: string]; add: [id: string]; new: [] }>()

const { t } = useI18n()
const { money } = useFormat()

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
</script>

<template>
  <div
    ref="track"
    class="track"
    role="group"
    aria-roledescription="carousel"
    :aria-label="t('goals.title')"
    data-swipe-lock
    @scroll.passive="onScroll"
  >
    <div v-for="g in goals" :key="g.id" class="slide">
      <div class="neu-3 gcard">
        <button type="button" class="open" :aria-label="t('goals.openN', { name: g.name })" @click="emit('open', g.id)">
          <GoalRing :percent="g.percent" :label="t('goals.progressLabel', { name: g.name })" />
          <span class="name">{{ g.name }}</span>
        </button>
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
  --w: 176px; --bleed: 24px;
  display: flex; gap: 14px; overflow-x: auto; scrollbar-width: none;
  scroll-snap-type: x mandatory; overscroll-behavior-x: contain;
  perspective: 720px; /* one shared vanishing point: the middle of the row */
  margin: 0 calc(-1 * var(--bleed)); padding: 22px calc(50% - var(--w) / 2) 30px;
}
.track::-webkit-scrollbar { display: none; }
.slide { flex: 0 0 var(--w); scroll-snap-align: center; will-change: transform, opacity; }

.gcard {
  display: flex; flex-direction: column; gap: 10px; width: 100%; height: 100%; padding: 14px;
  font: inherit; color: var(--vv-text); text-align: left; border: none;
}
.open {
  display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 4px 0 0;
  font: inherit; color: inherit; background: none; border: none; border-radius: var(--vv-r-sm);
  cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.open:focus-visible { outline: 2px solid var(--vv-accent-ring); outline-offset: 2px; }
.name { max-width: 100%; font-size: 15px; font-weight: 800; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.amounts { display: flex; flex-direction: column; min-width: 0; font-variant-numeric: tabular-nums; }
.amounts strong { font-size: 15px; font-weight: 800; white-space: nowrap; }
.amounts small { font-size: 12px; color: var(--vv-muted); white-space: nowrap; }

.newcard { align-items: center; justify-content: center; gap: 10px; min-height: 178px; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.newcard:active { box-shadow: var(--vv-p3); }
.newcard:focus-visible { outline: 2px solid var(--vv-accent-ring); outline-offset: 3px; }
.plus { display: grid; place-items: center; width: 48px; height: 48px; border-radius: var(--vv-r-md); box-shadow: var(--vv-p1); color: var(--vv-goal); }

@media (max-width: 560px) { .track { --bleed: 18px; } }
@media (prefers-reduced-motion: reduce) { .slide { will-change: auto; } }
</style>
