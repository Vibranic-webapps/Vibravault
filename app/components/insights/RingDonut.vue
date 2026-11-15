<script setup lang="ts">
import { ListFilter, X } from 'lucide-vue-next'
import {
  ringSlices, ringGeometry, placePopup,
  RING_VIEW, RING_RADIUS, RING_STROKE,
} from '~/utils/ringSlices'

/**
 * The ring: thick round-capped slices on a raised bezel, a centre puck (slot)
 * and a small raised pill that names the slice you point at. SpendRing and
 * CategoryRing both use it, so this is the one place that knows how a ring is
 * drawn and how its popup behaves.
 *
 * Popup (the pill): hover on a mouse, focus with the keyboard, tap on touch.
 *   - hover / keyboard focus only PREVIEW the slice;
 *   - click / tap / Enter / Space PIN it (tap again, tap outside or Escape closes);
 *   - a pinned slice that can narrow the list shows an action button inside the pill.
 * There is no visible legend on purpose. The same facts are in a visually hidden
 * list and in the slices' aria-labels, so nothing depends on hovering.
 *
 * Geometry (min arc, gaps, caps) is display only: the % text comes from the
 * parent, always from the exact integer cents.
 */
export interface DonutItem {
  key: string
  /** Integer cents (zero = not drawn). */
  cents: number
  /** Any CSS colour value, normally a var(--vv-...) token. */
  color: string
  label: string
  /** Exact share as text ("38%", "<1%"). */
  percentText: string
  /** Pinning it offers the "show these transactions" action. */
  selectable?: boolean
}

interface Props {
  items: DonutItem[]
  /** Key of the slice the page is narrowed to: it stays emphasised, the others fade. */
  active?: string | null
  /** Accessible name of the whole ring. */
  label: string
  showLabel: string
  clearLabel: string
}
const props = withDefaults(defineProps<Props>(), { active: null })
const emit = defineEmits<{ select: [key: string] }>()
const { money } = useFormat()

// ---- Drawing -------------------------------------------------------------------
const CENTER = RING_VIEW / 2
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS
/** The picked slice grows a little (stroke width, SVG units). */
const STROKE_PICKED = RING_STROKE + 4

const drawn = computed(() => {
  const slices = ringSlices(props.items.map((i) => ({ key: i.key, cents: i.cents })))
  const arcs = ringGeometry(slices)
  return arcs.map((arc) => ({ ...arc, item: props.items.find((i) => i.key === arc.key)! }))
})

function spoken(item: DonutItem) {
  return `${item.label}: ${money(item.cents)}, ${item.percentText}`
}

// ---- Which slice is shown ------------------------------------------------------
const hovered = ref<string | null>(null)
const focused = ref<string | null>(null) // keyboard focus only (:focus-visible)
const pinned = ref<string | null>(null)
const shownKey = computed(() => hovered.value ?? focused.value ?? pinned.value)
const shown = computed(() => drawn.value.find((d) => d.key === shownKey.value) ?? null)
/** What is emphasised: what you point at, else what the page is narrowed to. */
const emphasis = computed(() => shownKey.value ?? props.active)

/** The action only exists for a PINNED slice (a hover pill can't be reached by a mouse anyway). */
const canAct = computed(() => !!shown.value && shown.value.key === pinned.value && !!shown.value.item.selectable)
const isActive = computed(() => !!shown.value && shown.value.key === props.active)

function onEnter(key: string, e: PointerEvent) {
  if (e.pointerType === 'mouse') hovered.value = key
}
function onLeave(e: PointerEvent) {
  if (e.pointerType === 'mouse') hovered.value = null
}
function onFocus(key: string, e: FocusEvent) {
  // Only keyboard focus previews; a tap also focuses, and that must not double up with the pin.
  if ((e.target as Element).matches(':focus-visible')) focused.value = key
}
function toggle(key: string) {
  pinned.value = pinned.value === key ? null : key
}
function onKey(key: string, e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    toggle(key)
  }
}
function close() {
  hovered.value = null
  focused.value = null
  pinned.value = null
}
function onStageKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && shownKey.value) {
    e.stopPropagation()
    close()
  }
}
function act() {
  if (!shown.value) return
  emit('select', shown.value.key)
  pinned.value = null
}

// Tap outside the ring closes a pinned popup.
const stage = ref<HTMLElement | null>(null)
const ringEl = ref<HTMLElement | null>(null)
const pillEl = ref<HTMLElement | null>(null)
function onOutside(e: PointerEvent) {
  if (stage.value && !stage.value.contains(e.target as Node)) pinned.value = null
}
onMounted(() => document.addEventListener('pointerdown', onOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside))

// The slices changed under a pinned key (new period): drop it.
watch(drawn, (list) => {
  for (const ref_ of [pinned, hovered, focused]) {
    if (ref_.value && !list.some((d) => d.key === ref_.value)) ref_.value = null
  }
})

// ---- Pill position -------------------------------------------------------------
// Measured after the pill rendered its text (it is as wide as its content), then
// clamped into the stage by placePopup, so it can't overflow a narrow card.
const pos = ref({ left: 0, top: 0 })
async function place() {
  await nextTick()
  const s = shown.value
  const box = stage.value
  const ring = ringEl.value
  const pill = pillEl.value
  if (!s || !box || !ring || !pill) return
  const scale = ring.offsetWidth / RING_VIEW
  pos.value = placePopup({
    cx: ring.offsetLeft + ring.offsetWidth / 2,
    cy: ring.offsetTop + ring.offsetHeight / 2,
    outerRadius: (RING_RADIUS + STROKE_PICKED / 2) * scale,
    innerRadius: (RING_RADIUS - STROKE_PICKED / 2) * scale,
    mid: s.mid,
    width: pill.offsetWidth,
    height: pill.offsetHeight,
    boxWidth: box.clientWidth,
    boxHeight: box.clientHeight,
  })
}
watch([shownKey, canAct, isActive], place, { flush: 'post' })
</script>

<template>
  <div ref="stage" class="stage" @keydown="onStageKey">
    <div ref="ringEl" class="ring" :class="{ 'has-sel': emphasis !== null }">
      <svg :viewBox="`0 0 ${RING_VIEW} ${RING_VIEW}`" role="group" :aria-label="label">
        <circle class="track" :cx="CENTER" :cy="CENTER" :r="RING_RADIUS" :stroke-width="RING_STROKE" fill="none" />
        <circle
          v-for="d in drawn"
          :key="d.key"
          class="slice"
          :class="{ sel: emphasis === d.key }"
          role="button"
          tabindex="0"
          :aria-pressed="pinned === d.key"
          :aria-label="spoken(d.item)"
          :cx="CENTER"
          :cy="CENTER"
          :r="RING_RADIUS"
          fill="none"
          :stroke="d.item.color"
          :stroke-width="emphasis === d.key ? STROKE_PICKED : RING_STROKE"
          :stroke-linecap="d.full ? 'butt' : 'round'"
          :stroke-dasharray="`${d.dash} ${CIRCUMFERENCE}`"
          :stroke-dashoffset="d.offset"
          @pointerenter="onEnter(d.key, $event)"
          @pointerleave="onLeave($event)"
          @focus="onFocus(d.key, $event)"
          @blur="focused = null"
          @click="toggle(d.key)"
          @keydown="onKey(d.key, $event)"
        />
      </svg>
      <div class="bezel" aria-hidden="true" />
      <div class="puck"><slot /></div>
    </div>

    <!-- The pill. Its text is decoration (the slices and the hidden list say it
         for screen readers); the action button is a real, focusable control. -->
    <div
      ref="pillEl"
      class="pill"
      :class="{ on: !!shown, live: canAct }"
      :style="{ left: `${pos.left}px`, top: `${pos.top}px` }"
    >
      <template v-if="shown">
        <span class="p-text" aria-hidden="true">
          <span class="p-name"><i class="dot" :style="{ background: shown.item.color }" />{{ shown.item.label }}</span>
          <span class="p-num">{{ money(shown.item.cents) }}<em>{{ shown.item.percentText }}</em></span>
        </span>
        <button v-if="canAct" type="button" class="p-act" @click="act">
          <component :is="isActive ? X : ListFilter" :size="13" aria-hidden="true" />
          {{ isActive ? clearLabel : showLabel }}
        </button>
      </template>
    </div>

    <!-- The same facts without hovering: spoken on pin/focus, and listed. -->
    <p class="sr-only" aria-live="polite">{{ shown ? spoken(shown.item) : '' }}</p>
    <ul class="sr-only">
      <li v-for="d in drawn" :key="d.key">{{ spoken(d.item) }}</li>
    </ul>
  </div>
</template>

<style scoped>
.stage { position: relative; display: flex; justify-content: center; width: 100%; }
/* 150 viewBox units -> as wide as the card allows, up to 150px. */
.ring { position: relative; width: min(150px, 86%); aspect-ratio: 1; flex: none; }
/* Only the ring's own svg. A bare `svg` selector also hit the filter icon inside the
   pill (a child component's root gets this component's scope), blowing it up to 100% and rotating it. */
.ring > svg { display: block; width: 100%; height: 100%; transform: rotate(-90deg); overflow: visible; }
.track { stroke: var(--vv-chart-grid); }
.slice { cursor: pointer; outline: none; transition: opacity .18s ease, stroke-width .18s ease; }
.ring.has-sel .slice:not(.sel) { opacity: .35; }

/* Raised rim around the ring + a raised puck in the middle. Both are the
   surface colour, so they only read through the shadow tokens. */
.bezel { position: absolute; inset: 0; border-radius: 50%; box-shadow: var(--vv-e2); pointer-events: none; }
.puck {
  position: absolute; inset: 18%; display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 4px; border-radius: 50%; background: var(--vv-surface); box-shadow: var(--vv-e1);
  text-align: center; pointer-events: none; container-type: inline-size;
}

.pill {
  position: absolute; z-index: 3; width: max-content; max-width: 100%;
  padding: 7px 12px; border-radius: var(--vv-r-sm); background: var(--vv-surface); box-shadow: var(--vv-e2);
  font-size: 12px; line-height: 1.3; opacity: 0; transform: scale(.96); pointer-events: none;
  transition: opacity .15s ease, transform .15s ease;
}
.pill.on { opacity: 1; transform: scale(1); }
.pill.live { pointer-events: auto; }
.p-text { display: grid; gap: 1px; }
.p-name { display: flex; align-items: center; gap: 6px; min-width: 0; font-weight: 700; overflow-wrap: anywhere; }
.dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.p-num { font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
.p-num em { margin-left: 6px; font-style: normal; font-weight: 600; color: var(--vv-muted); }

/* Compact to look at, 44px tall to hit: the extra height is invisible padding. */
.p-act {
  display: flex; align-items: center; gap: 5px; margin: 4px -4px -6px; padding: 12px 4px;
  font: inherit; font-size: 12px; font-weight: 700; color: var(--vv-accent);
  background: none; border: none; border-radius: var(--vv-r-badge); cursor: pointer; text-align: left;
  -webkit-tap-highlight-color: transparent;
}
.p-act:focus-visible { outline: 2px solid var(--vv-accent-ring); outline-offset: 0; }

.sr-only { position: absolute; width: 1px; height: 1px; margin: 0; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; list-style: none; }

@media (prefers-reduced-motion: reduce) {
  .slice, .pill { transition: none; }
  .pill { transform: none; }
}
</style>
