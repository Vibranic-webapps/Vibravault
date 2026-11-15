<script setup lang="ts">
import { ringSlices, percentOfTotal, groupSmallest, UNSORTED_KEY } from '~/utils/ringSlices'
import type { DonutSlice } from './RingDonut.vue'

/**
 * Where the spending went: a donut in the category colours plus a legend of
 * rows (icon tile, name, amount, %). Picking a legend row (or a slice) filters
 * the transaction list below; picking it again clears. The page owns that
 * state: this component only shows `active` and says what was picked.
 *
 * More than 6 categories? The biggest 5 stay, the rest fold into one "Other"
 * slice. That grouped row is not pickable (it isn't one category).
 */
interface Props {
  categories: { categoryId: string | null; name: string | null; icon: string | null; color: string | null; totalCents: number }[]
  /** Key of the picked category (its id, or UNSORTED_KEY), or null. */
  active: string | null
}
const props = defineProps<Props>()
const emit = defineEmits<{ select: [key: string | null] }>()
const { t } = useI18n()
const { money } = useFormat()

const OTHER_KEY = '__other'

interface Row {
  key: string
  name: string
  icon: string | null
  /** Token name (cat-3) for the tile; null = neutral. */
  color: string | null
  cents: number
  pickable: boolean
}

const totalCents = computed(() => props.categories.reduce((sum, c) => sum + c.totalCents, 0))

const rows = computed<Row[]>(() => {
  const sorted = [...props.categories].filter((c) => c.totalCents > 0).sort((a, b) => b.totalCents - a.totalCents)
  const { shown, rest } = groupSmallest(sorted)
  const out: Row[] = shown.map((c) => ({
    key: c.categoryId ?? UNSORTED_KEY,
    name: c.name ?? t('insights.unsorted'),
    icon: c.icon,
    color: c.color,
    cents: c.totalCents,
    pickable: true,
  }))
  if (rest) {
    out.push({ key: OTHER_KEY, name: t('insights.otherGroup', { n: rest.count }), icon: 'package', color: null, cents: rest.cents, pickable: false })
  }
  return out
})

// Slice colour: the category's darker "-fg" shade (its pastel tile colour is
// too faint against the cream card). Unsorted / grouped = neutral greys.
function sliceColor(r: Row): string {
  if (r.key === OTHER_KEY) return 'var(--vv-muted)'
  return r.color ? `var(--vv-${r.color}-fg)` : 'var(--vv-muted-2)'
}

const slices = computed<DonutSlice[]>(() => {
  const drawn = ringSlices(rows.value.map((r) => ({ key: r.key, cents: r.cents })))
  return drawn.map((s) => {
    const row = rows.value.find((r) => r.key === s.key)!
    return { key: s.key, start: s.start, arc: s.arc, color: sliceColor(row), selectable: row.pickable }
  })
})

function percentText(cents: number): string {
  const pct = percentOfTotal(cents, totalCents.value)
  return cents > 0 && pct === 0 ? t('insights.lessThanOne') : t('insights.percent', { n: pct })
}

function tile(r: Row) {
  return r.color ? { background: `var(--vv-${r.color})`, color: `var(--vv-${r.color}-fg)` } : {}
}

// Same key again = clear.
function pick(key: string) {
  emit('select', props.active === key ? null : key)
}

const totalText = computed(() => money(totalCents.value))
</script>

<template>
  <section class="neu-3 card" :aria-label="t('insights.catTitle')">
    <h2>{{ t('insights.catTitle') }}</h2>

    <div class="ring-wrap">
      <InsightsRingDonut :slices="slices" :active="active" interactive @select="pick">
        <div class="fit">
          <strong class="total" :style="{ '--len': totalText.length }">{{ totalText }}</strong>
        </div>
        <span class="cap">{{ t('insights.catSpent') }}</span>
      </InsightsRingDonut>
    </div>

    <p class="hint">{{ t('insights.catHint') }}</p>

    <ul class="legend">
      <li v-for="r in rows" :key="r.key">
        <component
          :is="r.pickable ? 'button' : 'div'"
          class="row"
          :class="{ on: active === r.key, dim: active !== null && active !== r.key }"
          v-bind="r.pickable ? { type: 'button', 'aria-pressed': active === r.key } : {}"
          @click="r.pickable ? pick(r.key) : undefined"
        >
          <span class="tile neu" :style="tile(r)" aria-hidden="true"><CategoryIcon :name="r.icon" :size="16" /></span>
          <span class="name">{{ r.name }}</span>
          <strong class="amount">{{ money(r.cents) }}</strong>
          <span class="pct">{{ percentText(r.cents) }}</span>
        </component>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.card { padding: 18px 14px 12px; }
h2 { margin: 0 4px 14px; font-size: 16px; font-weight: 800; }
.ring-wrap { display: flex; justify-content: center; --ring-size: min(190px, 56vw); }
/* The hole is narrow: the total shrinks to fit on one line, however big. */
.fit { width: 100%; container-type: inline-size; }
.total {
  display: block; white-space: nowrap; font-weight: 800; font-variant-numeric: tabular-nums;
  font-size: clamp(10px, calc(100cqi / (var(--len, 8) * 0.64)), 18px);
}
.cap { margin-top: 2px; font-size: 11px; color: var(--vv-muted); }
.hint { margin: 12px 4px 4px; text-align: center; font-size: 12px; color: var(--vv-muted); }

.legend { list-style: none; margin: 0; padding: 0; }
.legend li + li { border-top: 1px solid var(--vv-chart-grid); }
.row {
  display: flex; align-items: center; gap: 12px; width: 100%; min-height: 52px; padding: 6px 4px;
  font: inherit; text-align: left; color: var(--vv-text);
  background: none; border: none; border-radius: var(--vv-r-badge);
  -webkit-tap-highlight-color: transparent; transition: opacity .15s ease;
}
button.row { cursor: pointer; }
button.row:focus-visible { outline: 2px solid var(--vv-accent-ring); outline-offset: 2px; }
/* The picked row is pressed IN, like every active thing in the app. */
.row.on { box-shadow: var(--vv-p1); }
.row.dim { opacity: .55; }
.tile { display: grid; place-items: center; width: 34px; height: 34px; flex: none; color: var(--vv-muted); border-radius: var(--vv-r-badge); }
.name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 600; }
.amount { font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
.pct { width: 3.8em; text-align: right; font-size: 13px; color: var(--vv-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }

@media (prefers-reduced-motion: reduce) { .row { transition: none; } }
</style>
