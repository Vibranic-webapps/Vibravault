<script setup lang="ts">
/**
 * "Am I positive or negative?" in one card: the big signed net, a plain
 * sentence, and a proportional In-vs-Out bar. The amounts are written out
 * beside the bar, so colour is never the only signal.
 *
 * Props are the insights totals: income >= 0, expense <= 0 (negative cents).
 */
interface Props { incomeCents: number; expenseCents: number; netCents: number }
const props = defineProps<Props>()
const { t } = useI18n()
const { money } = useFormat()

/** A segment that exists is never thinner than this share of the bar, so a small one is still visible. */
const BAR_MIN_PCT = 3

const out = computed(() => Math.abs(props.expenseCents))
const flow = computed(() => props.incomeCents + out.value)

// Both zero (only transfers in the period): no bar, just the sentence.
const hasBar = computed(() => flow.value > 0)
const inPct = computed(() => {
  if (!hasBar.value) return 0
  if (out.value === 0) return 100
  if (props.incomeCents === 0) return 0
  const raw = (props.incomeCents / flow.value) * 100
  return Math.min(100 - BAR_MIN_PCT, Math.max(BAR_MIN_PCT, raw))
})

const sentence = computed(() => {
  if (props.netCents > 0) return t('insights.verdictPositive', { amount: money(props.netCents) })
  if (props.netCents < 0) return t('insights.verdictNegative', { amount: money(Math.abs(props.netCents)) })
  return t('insights.verdictEven')
})

const netText = computed(() => money(props.netCents, { signed: true }))
const netClass = computed(() => (props.netCents < 0 ? 'vv-amount-neg' : props.netCents > 0 ? 'vv-amount-in' : ''))
</script>

<template>
  <section class="neu-3 verdict" :aria-label="t('insights.verdictLabel')">
    <p class="net" :class="netClass" :style="{ '--len': netText.length }">{{ netText }}</p>
    <p class="sentence">{{ sentence }}</p>

    <template v-if="hasBar">
      <!-- The bar repeats what the numbers below say, so it is hidden from screen readers. -->
      <div class="bar" aria-hidden="true">
        <span v-if="inPct > 0" class="seg in" :style="{ width: `${inPct}%` }" />
        <span v-if="inPct < 100" class="seg out" :style="{ width: `${100 - inPct}%` }" />
      </div>
      <p class="amounts">
        <span><i class="sw in" aria-hidden="true" />{{ t('home.in') }} <strong class="vv-amount-in">{{ money(incomeCents, { signed: true }) }}</strong></span>
        <span><i class="sw out" aria-hidden="true" />{{ t('home.out') }} <strong class="vv-amount-out">{{ money(expenseCents) }}</strong></span>
      </p>
    </template>
  </section>
</template>

<style scoped>
.verdict { padding: 20px 18px 18px; container-type: inline-size; }
/* One line however big: size follows the card width and the text length. */
.net {
  margin: 0; font-weight: 800; letter-spacing: -.01em; white-space: nowrap; font-variant-numeric: tabular-nums;
  font-size: clamp(22px, calc(100cqi / (var(--len, 8) * 0.62)), 38px);
}
.sentence { margin: 4px 0 16px; font-size: 14px; color: var(--vv-muted); }

.bar { display: flex; gap: 3px; height: 14px; }
.seg { display: block; height: 100%; min-width: 0; }
.seg.in { background: var(--vv-chart-in); border-radius: var(--vv-r-badge) 3px 3px var(--vv-r-badge); }
.seg.out { background: var(--vv-chart-out); border-radius: 3px var(--vv-r-badge) var(--vv-r-badge) 3px; }
.seg:only-child { border-radius: var(--vv-r-badge); }

.amounts { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px 14px; margin: 10px 0 0; font-size: 13px; color: var(--vv-muted); }
.amounts span { display: inline-flex; align-items: center; gap: 6px; min-width: 0; }
.amounts strong { font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
.sw { width: 10px; height: 10px; border-radius: 3px; display: inline-block; flex: none; }
.sw.in { background: var(--vv-chart-in); }
.sw.out { background: var(--vv-chart-out); }
</style>
