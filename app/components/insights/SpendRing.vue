<script setup lang="ts">
import { percentOfTotal } from '~/utils/ringSlices'
import type { DonutItem } from './RingDonut.vue'

/**
 * "How big is the subscriptions share of my income?" - the period's income is
 * 100% of the ring, split into subscriptions / other spending / left over. Half-width card: the ring,
 * ONE number in the centre (the subscriptions share) and a popup per slice.
 * The per-subscription lines live in SubsList, not here.
 *
 *   normal      sub + other + left = income
 *   overspent   the ring is full of spending, no left-over slice, "over by" note
 *   no income   a ring of spending only; every % is a share of spending
 *   no subs     the ring still shows (0% in the centre)
 *
 * Percentages come from integer cents and are rounded for display only.
 */
interface Props {
  ring: { incomeCents: number; subscriptionsCents: number; otherSpendCents: number; leftCents: number; overCents: number }
}
const props = defineProps<Props>()
const { t } = useI18n()
const { money } = useFormat()

const hasIncome = computed(() => props.ring.incomeCents > 0)
// With no income the ring is a share of spending, so the title must not say "income".
const title = computed(() => (hasIncome.value ? t('insights.ringTitle') : t('insights.ringTitleNoIncome')))
const spendCents = computed(() => props.ring.subscriptionsCents + props.ring.otherSpendCents)
// What the percentages are shares OF: income when there is one, else spending.
const base = computed(() => (hasIncome.value ? props.ring.incomeCents : spendCents.value))

function percentText(cents: number): string {
  const pct = percentOfTotal(cents, base.value)
  return cents > 0 && pct === 0 ? t('insights.lessThanOne') : t('insights.percent', { n: pct })
}

// Left over is 0 when overspent (the server sends 0) or when there is no income: not drawn then.
const items = computed<DonutItem[]>(() => [
  { key: 'subs', label: t('insights.subscriptions'), cents: props.ring.subscriptionsCents, color: 'var(--vv-tint-lavender-fg)' },
  { key: 'other', label: t('insights.otherSpending'), cents: props.ring.otherSpendCents, color: 'var(--vv-chart-out)' },
  { key: 'left', label: t('insights.leftOver'), cents: props.ring.leftCents, color: 'var(--vv-chart-in)' },
].map((r) => ({ ...r, percentText: percentText(r.cents) })))

const overspent = computed(() => props.ring.overCents > 0)
</script>

<template>
  <section class="neu-3 card" :aria-label="title">
    <h2>{{ title }}</h2>

    <InsightsRingDonut :items="items" :label="title" :show-label="t('insights.ringShow')" :clear-label="t('insights.ringClear')">
      <strong class="num">{{ percentText(ring.subscriptionsCents) }}</strong>
      <span class="cap">{{ t(hasIncome ? 'insights.puckSubs' : 'insights.puckSubsNoIncome') }}</span>
    </InsightsRingDonut>

    <p v-if="overspent" class="over vv-amount-neg">{{ t('insights.overBy', { amount: money(ring.overCents) }) }}</p>
  </section>
</template>

<style scoped>
.card { padding: 14px 12px 14px; min-width: 0; }
/* Two lines tall, so the rings of the two cards start at the same height. */
h2 { margin: 0 0 10px 2px; font-size: 13px; font-weight: 800; line-height: 1.25; min-height: 2.5em; }
.num { font-size: clamp(11px, 22cqi, 18px); line-height: 1.1; font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; }
.cap { margin-top: 1px; max-width: 100%; font-size: 9.5px; line-height: 1.15; color: var(--vv-muted); overflow-wrap: anywhere; }
.over { margin: 10px 2px 0; text-align: center; font-size: 12px; font-weight: 700; line-height: 1.3; }
</style>
