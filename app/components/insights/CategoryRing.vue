<script setup lang="ts">
import { percentOfTotal, groupSmallest, UNSORTED_KEY } from '~/utils/ringSlices'
import { moneyCompact } from '~/utils/moneyCompact'
import type { DonutItem } from './RingDonut.vue'

/**
 * Where the spending went: a half-width ring card in the category colours, the
 * total in the centre, and a popup per slice (name, amount, %). No legend:
 * the popup (and a hidden list for screen readers) carries the details.
 *
 * Pinning a slice offers "show these transactions": that narrows the list
 * below. The page owns that state: this component only shows `active` and says
 * what was picked.
 *
 * More than 6 categories? The biggest 5 stay, the rest fold into one "Other"
 * slice. That grouped slice can be looked at but not picked (it isn't one category).
 */
interface Props {
  categories: { categoryId: string | null; name: string | null; icon: string | null; color: string | null; totalCents: number }[]
  /** Key of the picked category (its id, or UNSORTED_KEY), or null. */
  active: string | null
}
const props = defineProps<Props>()
const emit = defineEmits<{ select: [key: string | null] }>()
const { t } = useI18n()
const { localeTag } = useFormat()

const OTHER_KEY = '__other'

const totalCents = computed(() => props.categories.reduce((sum, c) => sum + c.totalCents, 0))

// Slice colour: the category's darker "-fg" shade (its pastel tile colour is
// too faint against the cream card). Unsorted / grouped = neutral greys.
function sliceColor(color: string | null): string {
  return color ? `var(--vv-${color}-fg)` : 'var(--vv-muted-2)'
}

function percentText(cents: number): string {
  const pct = percentOfTotal(cents, totalCents.value)
  return cents > 0 && pct === 0 ? t('insights.lessThanOne') : t('insights.percent', { n: pct })
}

const items = computed<DonutItem[]>(() => {
  const sorted = [...props.categories].filter((c) => c.totalCents > 0).sort((a, b) => b.totalCents - a.totalCents)
  const { shown, rest } = groupSmallest(sorted)
  const out: DonutItem[] = shown.map((c) => ({
    key: c.categoryId ?? UNSORTED_KEY,
    label: c.name ?? t('insights.unsorted'),
    cents: c.totalCents,
    color: sliceColor(c.color),
    percentText: percentText(c.totalCents),
    selectable: true,
  }))
  if (rest) {
    out.push({
      key: OTHER_KEY,
      label: t('insights.otherGroup', { n: rest.count }),
      cents: rest.cents,
      color: 'var(--vv-muted)',
      percentText: percentText(rest.cents),
      selectable: false,
    })
  }
  return out
})

// The ring's centre is small: no cents from 1.000 euro up (exact figure: popup / hidden list).
const totalText = computed(() => moneyCompact(totalCents.value, localeTag.value))

// Same key again = clear.
function pick(key: string) {
  emit('select', props.active === key ? null : key)
}
</script>

<template>
  <section class="neu-3 card" :aria-label="t('insights.catTitle')">
    <h2>{{ t('insights.catTitle') }}</h2>

    <InsightsRingDonut
      :items="items"
      :active="active"
      :label="t('insights.catTitle')"
      :show-label="t('insights.ringShow')"
      :clear-label="t('insights.ringClear')"
      @select="pick"
    >
      <strong class="num" :style="{ '--len': totalText.length }">{{ totalText }}</strong>
      <span class="cap">{{ t('insights.catSpent') }}</span>
    </InsightsRingDonut>
  </section>
</template>

<style scoped>
.card { padding: 14px 12px 14px; min-width: 0; }
/* Two lines tall, so the rings of the two cards start at the same height. */
h2 { margin: 0 0 10px 2px; font-size: 13px; font-weight: 800; line-height: 1.25; min-height: 2.5em; }
/* The hole is small: the total shrinks to fit on one line, however big. */
.num {
  white-space: nowrap; font-weight: 800; font-variant-numeric: tabular-nums;
  font-size: clamp(9px, calc(100cqi / (var(--len, 8) * 0.64)), 16px);
}
.cap { margin-top: 1px; font-size: 9.5px; line-height: 1.15; color: var(--vv-muted); }
</style>
