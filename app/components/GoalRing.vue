<script setup lang="ts">
/**
 * A goal's progress as a ring: a pressed-in groove with an amber arc and the
 * percent in the middle. The small-card version of GoalProgressBar: the
 * arc takes the card's --g-ink (its tint), else --vv-goal (teal = income, coral = spending, saving is neither).
 * The arc draws itself in when the card first appears.
 */
const props = withDefaults(defineProps<{ percent: number; label: string; size?: number }>(), { size: 76 })

const stroke = computed(() => Math.max(5, Math.round(props.size * 0.1))) // thinner on the small badge
const radius = computed(() => (props.size - stroke.value) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const clamped = computed(() => Math.min(100, Math.max(0, Math.round(props.percent))))

// Starts empty and moves to the real value once mounted, so the CSS transition draws the arc.
const shown = ref(0)
onMounted(() => requestAnimationFrame(() => { shown.value = clamped.value }))
watch(clamped, (v) => { shown.value = v })
const offset = computed(() => circumference.value * (1 - shown.value / 100))
</script>

<template>
  <div
    class="ring"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.27)}px` }"
    role="progressbar"
    :aria-label="label"
    :aria-valuenow="clamped"
    aria-valuemin="0"
    aria-valuemax="100"
  >
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" aria-hidden="true">
      <circle class="groove" :cx="size / 2" :cy="size / 2" :r="radius" :stroke-width="stroke" fill="none" />
      <circle
        v-if="clamped > 0"
        class="arc"
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        :stroke-width="stroke"
        fill="none"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="offset"
        :transform="`rotate(-90 ${size / 2} ${size / 2})`"
      />
    </svg>
    <span class="pct">{{ clamped }}<small>%</small></span>
  </div>
</template>

<style scoped>
.ring { position: relative; display: grid; place-items: center; flex: none; }
svg { position: absolute; inset: 0; }
.groove { stroke: var(--vv-chart-grid); }
.arc { stroke: var(--g-ink, var(--vv-goal)); transition: stroke-dashoffset .8s cubic-bezier(.22, 1, .36, 1); }
.pct { font-weight: 800; font-variant-numeric: tabular-nums; }
.pct small { margin-left: 1px; font-size: .62em; font-weight: 700; color: var(--vv-muted); }
@media (prefers-reduced-motion: reduce) { .arc { transition: none; } }
</style>
