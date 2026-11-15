<script setup lang="ts">
/**
 * Money in vs out per bucket (a day in the week view, a week in the month
 * view), in the same style as Home's WeekChart: one button per column, tap to
 * select, the detail panel says it in words, the table has every number.
 *
 * Net per bucket is a small pip under the bars: filled = net zero or above,
 * hollow = below. The selected bucket's panel states the net as text.
 */
export interface FlowBucket {
  key: string
  from: string
  to: string
  label: string
  incomeCents: number
  /** Negative cents. */
  expenseCents: number
  netCents: number
}

interface Props { series: FlowBucket[]; kind: 'week' | 'month'; title: string }
const props = defineProps<Props>()
const selected = defineModel<string | null>('selected', { default: null })

const { t } = useI18n()
const { money, date } = useFormat()
const showTable = ref(false)

/** The tallest a bar can be is 100% of the bar area; anything non-zero is at least this tall. */
const MIN_BAR_PCT = 3

// ONE axis for both series, like WeekChart: an in bar and an out bar of the
// same height mean the same amount.
const peak = computed(() => Math.max(1, ...props.series.map((b) => Math.max(b.incomeCents, Math.abs(b.expenseCents)))))
function height(cents: number) {
  return `${cents === 0 ? 0 : Math.max(MIN_BAR_PCT, (Math.abs(cents) / peak.value) * 100)}%`
}

const current = computed(() => props.series.find((b) => b.key === selected.value) ?? null)

function toggle(b: FlowBucket) {
  selected.value = selected.value === b.key ? null : b.key
}

function range(b: FlowBucket) {
  if (b.from === b.to) return date(b.from, { weekday: 'long', day: 'numeric', month: 'long' })
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  return `${date(b.from, opts)} – ${date(b.to, opts)}`
}

// Week view: "Mon" over "9". Month view: the server's "1–7".
function weekday(b: FlowBucket) {
  return props.kind === 'week' ? date(b.from, { weekday: 'short' }) : null
}

function spoken(b: FlowBucket) {
  return `${range(b)}: ${t('home.in')} ${money(b.incomeCents)}, ${t('home.out')} ${money(b.expenseCents)}, ${t('home.net')} ${money(b.netCents, { signed: true })}`
}
</script>

<template>
  <section class="neu-3 card" :aria-label="title">
    <div class="head">
      <h2>{{ title }}</h2>
      <div class="legend">
        <span><i class="sw in" aria-hidden="true" /> {{ t('home.in') }}</span>
        <span><i class="sw out" aria-hidden="true" /> {{ t('home.out') }}</span>
      </div>
    </div>

    <div class="chart">
      <button
        v-for="b in series"
        :key="b.key"
        type="button"
        class="col"
        :class="{ on: selected === b.key }"
        :aria-pressed="selected === b.key"
        :aria-label="spoken(b)"
        @click="toggle(b)"
      >
        <span class="bars">
          <span class="bar in" :style="{ height: height(b.incomeCents) }" />
          <span class="bar out" :style="{ height: height(b.expenseCents) }" />
        </span>
        <span class="pip" :class="b.netCents >= 0 ? 'up' : 'down'" aria-hidden="true" />
        <span class="label">
          <span v-if="weekday(b)" class="wd">{{ weekday(b) }}</span>
          <span>{{ b.label }}</span>
        </span>
      </button>
    </div>

    <!-- Always the same height, so tapping never makes the page jump. -->
    <div class="detail" aria-live="polite">
      <template v-if="current">
        <p class="d-range">{{ range(current) }}</p>
        <div class="d-values">
          <p><strong class="vv-amount-in">{{ money(current.incomeCents, { signed: true }) }}</strong><small>{{ t('home.in') }}</small></p>
          <p><strong class="vv-amount-out">{{ money(current.expenseCents) }}</strong><small>{{ t('home.out') }}</small></p>
          <p><strong :class="current.netCents < 0 ? 'vv-amount-neg' : 'vv-amount-in'">{{ money(current.netCents, { signed: true }) }}</strong><small>{{ t('home.net') }}</small></p>
        </div>
      </template>
      <p v-else class="hint">{{ t('insights.flowHint') }}</p>
    </div>

    <button class="table-toggle" type="button" :aria-expanded="showTable" @click="showTable = !showTable">
      {{ showTable ? t('home.hideNumbers') : t('home.showNumbers') }}
    </button>

    <table v-if="showTable" class="tbl">
      <thead>
        <tr><th>{{ t('insights.bucket') }}</th><th>{{ t('home.in') }}</th><th>{{ t('home.out') }}</th><th>{{ t('home.net') }}</th></tr>
      </thead>
      <tbody>
        <tr v-for="b in series" :key="b.key">
          <td>{{ range(b) }}</td>
          <td class="num">{{ money(b.incomeCents, { signed: true }) }}</td>
          <td class="num">{{ money(b.expenseCents) }}</td>
          <td class="num">{{ money(b.netCents, { signed: true }) }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.card { padding: 14px 14px 10px; --chart-h: 110px; }
.head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 4px 8px; }
.head h2 { margin: 0; font-size: 16px; font-weight: 800; }
.legend { display: flex; gap: 14px; font-size: 12px; color: var(--vv-muted); }
.legend span { display: flex; align-items: center; gap: 6px; }
.sw { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
.sw.in { background: var(--vv-chart-in); }
.sw.out { background: var(--vv-chart-out); }

.chart { display: flex; gap: 4px; height: var(--chart-h); }
.col {
  flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: stretch; gap: 4px;
  padding: 4px 2px 4px; font: inherit; color: inherit;
  background: none; border: none; border-radius: var(--vv-r-badge); cursor: pointer;
  -webkit-tap-highlight-color: transparent; transition: box-shadow .14s ease;
}
.col.on { box-shadow: var(--vv-p1); }
.col:focus-visible { outline: 2px solid var(--vv-accent-ring); outline-offset: 2px; }

.bars { flex: 1; display: flex; align-items: flex-end; justify-content: center; gap: 2px; border-bottom: 1px solid var(--vv-chart-grid); }
.bar { width: 42%; max-width: 18px; border-radius: 4px 4px 0 0; transition: height .25s ease; }
.bar.in { background: var(--vv-chart-in); }
.bar.out { background: var(--vv-chart-out); }

/* Net: filled dot = zero or above, hollow ring = below (shape, not just colour). */
.pip { align-self: center; width: 8px; height: 8px; box-sizing: border-box; border-radius: 50%; }
.pip.up { background: var(--vv-chart-in); }
.pip.down { border: 2px solid var(--vv-chart-out); }

.label { display: flex; flex-direction: column; align-items: center; font-size: 11px; color: var(--vv-muted-2); white-space: nowrap; }
.wd { font-size: 10px; text-transform: capitalize; }
.col.on .label { color: var(--vv-text); font-weight: 700; }

.detail { min-height: 68px; margin-top: 8px; padding: 8px 14px; border-radius: var(--vv-r-sm); box-shadow: var(--vv-p2); }
.d-range { margin: 0 0 4px; font-size: 12px; font-weight: 600; color: var(--vv-muted); }
.d-values { display: flex; flex-wrap: wrap; gap: 4px 22px; }
.d-values p { margin: 0; display: flex; flex-direction: column; min-width: 0; }
.d-values strong { font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; }
.d-values small { font-size: 11px; color: var(--vv-muted); }
.hint { margin: 0; display: grid; place-items: center; min-height: 50px; font-size: 13px; color: var(--vv-muted); text-align: center; }

.table-toggle {
  margin-top: 4px; padding: 0 14px; min-height: 44px; font: inherit; font-size: 12px; font-weight: 600;
  color: var(--vv-muted); background: var(--vv-surface);
  border: none; border-radius: var(--vv-r-badge); box-shadow: var(--vv-e1); cursor: pointer;
}
.table-toggle:active { box-shadow: var(--vv-p1); }
.table-toggle:focus-visible { outline: 2px solid var(--vv-accent-ring); outline-offset: 2px; }
.tbl { width: 100%; margin-top: 14px; border-collapse: collapse; font-size: 12px; }
.tbl th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--vv-muted-2); padding-bottom: 6px; }
.tbl th:not(:first-child) { text-align: right; }
.tbl td { padding: 6px 0; border-top: 1px solid var(--vv-chart-grid); }
.tbl .num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; padding-left: 8px; }

@media (prefers-reduced-motion: reduce) { .col, .bar { transition: none; } }
</style>
