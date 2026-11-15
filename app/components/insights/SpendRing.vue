<script setup lang="ts">
import { ringSlices, percentOfTotal } from '~/utils/ringSlices'
import type { DonutSlice } from './RingDonut.vue'

/**
 * "Where does my income go?" - the period's income is 100% of the ring, split
 * into subscriptions / other spending / left over.
 *
 *   normal      sub + other + left = income
 *   overspent   the ring is full of spending, no left-over slice, "over by" note
 *   no income   a ring of spending only; every % is a share of spending
 *   no subs     the ring still shows (0% subscriptions) plus a nudge to mark a category
 *
 * Everything is also written out as text (centre + legend), so the colours are
 * never the only signal. Percentages come from integer cents and are rounded
 * for display only (see utils/ringSlices.ts).
 */
interface Props {
  ring: { incomeCents: number; subscriptionsCents: number; otherSpendCents: number; leftCents: number; overCents: number }
  subscriptions: { totalCents: number; items: { label: string; totalCents: number; count: number }[] }
  kind: 'week' | 'month'
}
const props = defineProps<Props>()
const { t } = useI18n()
const { money } = useFormat()

/** How many subscription lines are listed under the legend. */
const ITEMS_SHOWN = 5

const hasSubscriptions = computed(() => props.subscriptions.totalCents > 0)
const hasIncome = computed(() => props.ring.incomeCents > 0)
// With no income the ring is a share of spending, so the title must not say "income".
const title = computed(() => (hasIncome.value ? t('insights.ringTitle') : t('insights.ringTitleNoIncome')))
const spendCents = computed(() => props.ring.subscriptionsCents + props.ring.otherSpendCents)
// What the percentages are shares OF: income when there is one, else spending.
const base = computed(() => (hasIncome.value ? props.ring.incomeCents : spendCents.value))

interface Row { key: 'subs' | 'other' | 'left'; label: string; cents: number; color: string }
const rows = computed<Row[]>(() => [
  { key: 'subs', label: t('insights.subscriptions'), cents: props.ring.subscriptionsCents, color: 'var(--vv-tint-lavender-fg)' },
  { key: 'other', label: t('insights.otherSpending'), cents: props.ring.otherSpendCents, color: 'var(--vv-chart-out)' },
  // Not there when overspent (the server sends 0) or when there is no income.
  { key: 'left', label: t('insights.leftOver'), cents: props.ring.leftCents, color: 'var(--vv-chart-in)' },
])

const slices = computed<DonutSlice[]>(() => {
  const drawn = ringSlices(rows.value.map((r) => ({ key: r.key, cents: r.cents })))
  return drawn.map((s) => ({
    key: s.key,
    start: s.start,
    arc: s.arc,
    color: rows.value.find((r) => r.key === s.key)!.color,
  }))
})

function percentText(cents: number): string {
  const pct = percentOfTotal(cents, base.value)
  return cents > 0 && pct === 0 ? t('insights.lessThanOne') : t('insights.percent', { n: pct })
}

const centerPercent = computed(() => percentText(props.ring.subscriptionsCents))
const caption = computed(() => {
  if (!hasIncome.value) return t('insights.ofSpendingNoIncome')
  return props.kind === 'week' ? t('insights.ofIncomeWeek') : t('insights.ofIncomeMonth')
})
const overspent = computed(() => props.ring.overCents > 0)
const visibleRows = computed(() => rows.value.filter((r) => r.cents > 0))
const topItems = computed(() => props.subscriptions.items.slice(0, ITEMS_SHOWN))

// One sentence for screen readers instead of reading the pieces one by one.
const summary = computed(() =>
  `${title.value}: ${t('insights.subscriptions')} ${money(props.ring.subscriptionsCents)} (${centerPercent.value}), ${caption.value}`,
)
</script>

<template>
  <section class="neu-3 card" :aria-label="title">
    <h2>{{ title }}</h2>

    <div class="ring-wrap" role="img" :aria-label="summary">
      <InsightsRingDonut :slices="slices">
        <strong class="pct">{{ centerPercent }}</strong>
        <span class="cap">{{ caption }}</span>
      </InsightsRingDonut>
    </div>

    <p v-if="overspent" class="over vv-amount-neg">{{ t('insights.overBy', { amount: money(ring.overCents) }) }}</p>

    <ul class="legend">
      <li v-for="r in visibleRows" :key="r.key">
        <i class="sw" :style="{ background: r.color }" aria-hidden="true" />
        <span class="l-name">{{ r.label }}</span>
        <strong class="l-amount">{{ money(r.cents) }}</strong>
        <span class="l-pct">{{ percentText(r.cents) }}</span>
      </li>
    </ul>

    <!-- No subscriptions flagged (or none in this period): the ring still shows
         where the income goes; this is just a nudge underneath it. -->
    <div v-if="!hasSubscriptions" class="empty">
      <p>{{ t('insights.subsEmpty') }}</p>
      <NuxtLink class="vv-link" to="/categories">{{ t('insights.subsEmptyLink') }}</NuxtLink>
    </div>

    <div v-if="topItems.length" class="items">
      <h3>{{ t('insights.subsTop') }}</h3>
      <ul>
        <li v-for="item in topItems" :key="item.label">
          <span class="i-name">{{ item.label }}</span>
          <strong class="i-amount">{{ money(item.totalCents) }}</strong>
        </li>
      </ul>
      </div>
  </section>
</template>

<style scoped>
.card { padding: 18px 18px 16px; }
h2 { margin: 0 0 14px; font-size: 16px; font-weight: 800; }
h3 { margin: 0 0 6px; font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--vv-muted); }
.ring-wrap { display: flex; justify-content: center; --ring-size: min(190px, 56vw); }
.pct { font-size: 26px; font-weight: 800; line-height: 1.1; font-variant-numeric: tabular-nums; white-space: nowrap; }
.cap { margin-top: 3px; font-size: 11px; line-height: 1.25; color: var(--vv-muted); }

.over { margin: 12px 0 0; text-align: center; font-size: 13px; font-weight: 700; }

.legend, .items ul { list-style: none; margin: 0; padding: 0; }
.legend { margin-top: 16px; display: grid; gap: 8px; }
.legend li { display: flex; align-items: center; gap: 10px; min-height: 28px; font-size: 14px; }
.sw { width: 12px; height: 12px; border-radius: 4px; flex: none; }
.l-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.l-amount { font-variant-numeric: tabular-nums; white-space: nowrap; }
.l-pct { width: 4.2em; text-align: right; font-size: 13px; color: var(--vv-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }

.items { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--vv-chart-grid); }
.items li { display: flex; align-items: baseline; gap: 10px; padding: 5px 0; font-size: 14px; }
.i-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.i-amount { font-variant-numeric: tabular-nums; white-space: nowrap; }

.empty { margin-top: 14px; padding: 4px 0 6px; text-align: center; }
.empty p { margin: 0 0 8px; font-size: 14px; color: var(--vv-muted); }
.empty .vv-link { display: inline-block; padding: 10px 6px; font-size: 14px; }
</style>
