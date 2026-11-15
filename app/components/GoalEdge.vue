<script setup lang="ts">
import { GOAL_FRAME } from '~/utils/goalLook'

/**
 * A goal's progress drawn along the card's own rounded edge: a faint track all the way
 * round and a bright arc that fills clockwise from the top middle. Concentric with the card
 * (radius = card radius - inset), so it hugs the corners. Decorative (aria-hidden): the
 * percentage chip next to it is the accessible progress bar.
 * The arc draws itself in when the card first appears.
 */
const props = withDefaults(defineProps<{ percent: number; radius?: number; inset?: number; stroke?: number }>(), {
  radius: 28, inset: 3, stroke: 4,
})

const w = GOAL_FRAME.cardWidth
const h = GOAL_FRAME.cardHeight
const r = computed(() => Math.max(props.radius - props.inset, 1))
const path = computed(() => {
  const l = props.inset, t = props.inset, rr = r.value
  const right = w - props.inset, bottom = h - props.inset
  // Start at the top middle, go clockwise, finish back at the top middle.
  return [
    `M ${w / 2} ${t}`, `H ${right - rr}`, `A ${rr} ${rr} 0 0 1 ${right} ${t + rr}`,
    `V ${bottom - rr}`, `A ${rr} ${rr} 0 0 1 ${right - rr} ${bottom}`,
    `H ${l + rr}`, `A ${rr} ${rr} 0 0 1 ${l} ${bottom - rr}`,
    `V ${t + rr}`, `A ${rr} ${rr} 0 0 1 ${l + rr} ${t}`, `Z`,
  ].join(' ')
})

const clamped = computed(() => Math.min(100, Math.max(0, props.percent)))
const shown = ref(0)
onMounted(() => requestAnimationFrame(() => { shown.value = clamped.value }))
watch(clamped, (v) => { shown.value = v })
</script>

<template>
  <svg class="edge" :viewBox="`0 0 ${w} ${h}`" aria-hidden="true" focusable="false">
    <path class="track" :d="path" fill="none" :stroke-width="stroke" pathLength="100" />
    <path
      v-if="clamped > 0"
      class="arc"
      :d="path"
      fill="none"
      :stroke-width="stroke"
      stroke-linecap="round"
      pathLength="100"
      :stroke-dasharray="`${shown} 100`"
    />
  </svg>
</template>

<style scoped>
.edge { position: absolute; inset: 0; z-index: 2; width: 100%; height: 100%; pointer-events: none; }
.track { stroke: color-mix(in srgb, var(--g-ink, var(--vv-goal)) 16%, transparent); }
.arc { stroke: var(--g-ink, var(--vv-goal)); transition: stroke-dasharray .8s cubic-bezier(.22, 1, .36, 1); }
@media (prefers-reduced-motion: reduce) { .arc { transition: none; } }
</style>
