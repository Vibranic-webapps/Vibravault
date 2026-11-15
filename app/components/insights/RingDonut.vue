<script setup lang="ts">
/**
 * The donut itself - drawing only. SpendRing and CategoryRing both use it and
 * add their own legend, so there is exactly one place that knows how an arc is
 * built.
 *
 * Each slice is a stroked circle cut into a dash (stroke-dasharray), which also
 * makes a single full-circle slice work (a plain SVG arc path can't draw one).
 *
 * The SVG is decorative (aria-hidden): the legend next to it carries every
 * number as text, and the legend rows are the real, keyboard-reachable buttons.
 * Tapping a slice is only a convenience on top of that.
 */
export interface DonutSlice {
  key: string
  /** Where it starts / how long it is, as fractions of the circle (see ringSlices). */
  start: number
  arc: number
  /** Any CSS colour value, normally a var(--vv-...) token. */
  color: string
  /** Only meaningful when the donut is `interactive`. */
  selectable?: boolean
}

interface Props {
  slices: DonutSlice[]
  /** Key of the picked slice: all the others are dimmed. */
  active?: string | null
  interactive?: boolean
}
const props = withDefaults(defineProps<Props>(), { active: null, interactive: false })
const emit = defineEmits<{ select: [key: string] }>()

// Geometry in SVG units (the viewBox is VIEW x VIEW and scales to any size).
const VIEW = 100
const RADIUS = 38
const STROKE = 15
/** Visual breathing room between neighbouring slices, in SVG units. */
const GAP = 1.2

const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const CENTER = VIEW / 2

function dash(s: DonutSlice) {
  const gap = props.slices.length > 1 ? GAP : 0
  const len = Math.max(0, s.arc * CIRCUMFERENCE - gap)
  return `${len} ${CIRCUMFERENCE}`
}
</script>

<template>
  <div class="donut">
    <svg :viewBox="`0 0 ${VIEW} ${VIEW}`" aria-hidden="true" focusable="false">
      <circle class="track" :cx="CENTER" :cy="CENTER" :r="RADIUS" :stroke-width="STROKE" fill="none" />
      <circle
        v-for="s in slices"
        :key="s.key"
        class="slice"
        :class="{ pick: interactive && s.selectable, dim: active !== null && active !== s.key }"
        :cx="CENTER"
        :cy="CENTER"
        :r="RADIUS"
        :stroke-width="STROKE"
        fill="none"
        :style="{ stroke: s.color }"
        :stroke-dasharray="dash(s)"
        :stroke-dashoffset="-s.start * CIRCUMFERENCE"
        :transform="`rotate(-90 ${CENTER} ${CENTER})`"
        @click="interactive && s.selectable ? emit('select', s.key) : undefined"
      />
    </svg>
    <div class="center"><slot /></div>
  </div>
</template>

<style scoped>
.donut { position: relative; width: var(--ring-size, 168px); aspect-ratio: 1; flex: none; }
svg { display: block; width: 100%; height: 100%; }
.track { stroke: var(--vv-chart-grid); }
.slice { transition: stroke-dasharray .4s ease, stroke-dashoffset .4s ease, opacity .15s ease; }
.slice.dim { opacity: .3; }
.slice.pick { cursor: pointer; }
/* Sits inside the ring's hole; the hole is ~58% of the width. */
.center {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 22%; text-align: center; pointer-events: none;
}
@media (prefers-reduced-motion: reduce) { .slice { transition: none; } }
</style>
