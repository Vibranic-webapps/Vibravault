<script setup lang="ts">
/**
 * Money in vs out per week, with tap-for-detail (#4).
 *
 * Each week is ONE button covering its whole column - the hit target is the
 * column, not the thin bars, so a thumb can't miss it. Tapping selects the
 * week and the panel below says what happened: in, out, how many, and the
 * biggest spend. Values lead (bold), labels follow (muted).
 *
 * Accessible without the chart: every value is also in the table view, and
 * the buttons work with keyboard + screen reader (aria-pressed).
 */
export interface Week {
  weekStart: string
  from: string
  to: string
  label: string
  income: number
  expense: number
  count: number
  biggest: { label: string; amountCents: number } | null
}

const props = defineProps<{ weeks: Week[]; title: string }>()
const selected = defineModel<string | null>('selected', { default: null })

const { t } = useI18n()
const { money, date } = useFormat()
const showTable = ref(false)

// ONE axis for both series: scale against the largest single value, so an
// "in" bar and an "out" bar of the same height mean the same amount.
const peak = computed(() => Math.max(1, ...props.weeks.map((w) => Math.max(w.income, Math.abs(w.expense)))))
function height(v: number) {
  return `${v === 0 ? 0 : Math.max(3, (Math.abs(v) / peak.value) * 100)}%`
}

const current = computed(() => props.weeks.find((w) => w.weekStart === selected.value) ?? null)

function toggle(w: Week) {
  selected.value = selected.value === w.weekStart ? null : w.weekStart
}

function range(w: Week) {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  return w.from === w.to ? date(w.from, opts) : `${date(w.from, opts)} – ${date(w.to, opts)}`
}

function spoken(w: Week) {
  return `${range(w)}: ${t('home.in')} ${money(w.income)}, ${t('home.out')} ${money(w.expense)}`
}
</script>

<template>
  <div>
    <!-- Two series, so the legend is always there: identity is never colour alone. -->
    <div class="head">
      <h2>{{ title }}</h2>
      <div class="legend">
        <span><i class="sw in" aria-hidden="true" /> {{ t('home.in') }}</span>
        <span><i class="sw out" aria-hidden="true" /> {{ t('home.out') }}</span>
      </div>
    </div>

    <!-- The picked week is pressed in; the others keep their full colour, so
         "In" and "Out" never look like extra series. -->
    <div class="chart">
      <button
        v-for="w in weeks"
        :key="w.weekStart"
        type="button"
        class="col"
        :class="{ on: selected === w.weekStart }"
        :aria-pressed="selected === w.weekStart"
        :aria-label="spoken(w)"
        @click="toggle(w)"
      >
        <span class="bars">
          <span class="bar in" :style="{ height: height(w.income) }" />
          <span class="bar out" :style="{ height: height(w.expense) }" />
        </span>
        <span class="wlabel">{{ w.label }}</span>
      </button>
    </div>

    <!-- The detail panel. Always the same height so tapping never makes the
         page jump. -->
    <div class="detail" aria-live="polite">
      <template v-if="current">
        <p class="d-range">{{ range(current) }} · {{ t('home.weekCount', current.count) }}</p>
        <div class="d-values">
          <p><strong class="vv-amount-in">{{ money(current.income, { signed: true }) }}</strong><small>{{ t('home.in') }}</small></p>
          <p><strong class="vv-amount-out">{{ money(current.expense) }}</strong><small>{{ t('home.out') }}</small></p>
        </div>
        <p class="d-biggest">
          <template v-if="current.biggest">
            <small>{{ t('home.biggest') }}</small>
            <span class="d-name">{{ current.biggest.label }}</span>
            <strong>{{ money(current.biggest.amountCents) }}</strong>
          </template>
          <small v-else>{{ t('home.noSpend') }}</small>
        </p>
      </template>
      <p v-else class="hint">{{ t('home.weeksHint') }}</p>
    </div>

    <button class="table-toggle" type="button" :aria-expanded="showTable" @click="showTable = !showTable">
      {{ showTable ? t('home.hideNumbers') : t('home.showNumbers') }}
    </button>

    <table v-if="showTable" class="tbl">
      <thead><tr><th>{{ t('home.week') }}</th><th>{{ t('home.in') }}</th><th>{{ t('home.out') }}</th></tr></thead>
      <tbody>
        <tr v-for="w in weeks" :key="w.weekStart">
          <td>{{ range(w) }}</td>
          <td class="num">{{ money(w.income, { signed: true }) }}</td>
          <td class="num">{{ money(w.expense) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.head h2 { margin: 0; font-size: 16px; font-weight: 800; }
.legend { display: flex; gap: 14px; font-size: 12px; color: var(--vv-muted); }
.legend span { display: flex; align-items: center; gap: 6px; }
.sw { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
.sw.in { background: var(--vv-chart-in); }
.sw.out { background: var(--vv-chart-out); }

.chart { display: flex; gap: 6px; height: 170px; }
.col {
  flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: stretch; gap: 8px;
  padding: 8px 4px 6px; font: inherit; color: inherit;
  background: none; border: none; border-radius: var(--vv-r-badge); cursor: pointer;
  -webkit-tap-highlight-color: transparent; transition: box-shadow .14s ease;
}
/* Selected week = pressed IN, like every active thing in the app. */
.col.on { box-shadow: var(--vv-p1); }
.col:focus-visible { outline: 2px solid var(--vv-accent-ring); outline-offset: 2px; }

.bars {
  flex: 1; display: flex; align-items: flex-end; justify-content: center;
  gap: 2px; /* 2px surface gap between adjacent bars */
  border-bottom: 1px solid var(--vv-chart-grid);
}
.bar {
  width: 42%; max-width: 18px;
  border-radius: 4px 4px 0 0; /* rounded data-end, anchored to the baseline */
  transition: height .25s ease;
}
.bar.in { background: var(--vv-chart-in); }
.bar.out { background: var(--vv-chart-out); }
.wlabel { font-size: 11px; color: var(--vv-muted-2); text-align: center; white-space: nowrap; }
.col.on .wlabel { color: var(--vv-text); font-weight: 700; }

.detail { min-height: 112px; margin-top: 14px; padding: 14px 16px; border-radius: var(--vv-r-sm); box-shadow: var(--vv-p2); }
.d-range { margin: 0 0 10px; font-size: 13px; font-weight: 600; color: var(--vv-muted); }
.d-values { display: flex; gap: 22px; margin-bottom: 10px; }
.d-values p { margin: 0; display: flex; flex-direction: column; }
.d-values strong { font-size: 19px; font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; }
.d-values small, .d-biggest small { font-size: 12px; color: var(--vv-muted); }
.d-biggest { margin: 0; display: flex; align-items: baseline; gap: 8px; font-size: 14px; min-width: 0; }
.d-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.d-biggest strong { font-variant-numeric: tabular-nums; white-space: nowrap; }
.hint { margin: 0; display: grid; place-items: center; min-height: 84px; font-size: 13px; color: var(--vv-muted); text-align: center; }

.table-toggle {
  margin-top: 14px; padding: 8px 14px; font: inherit; font-size: 12px; font-weight: 600;
  color: var(--vv-muted); background: var(--vv-surface);
  border: none; border-radius: var(--vv-r-badge); box-shadow: var(--vv-e1); cursor: pointer;
}
.table-toggle:active { box-shadow: var(--vv-p1); }
.tbl { width: 100%; margin-top: 14px; border-collapse: collapse; font-size: 13px; }
.tbl th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--vv-muted-2); padding-bottom: 6px; }
.tbl td { padding: 6px 0; border-top: 1px solid var(--vv-chart-grid); }
.tbl .num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }

@media (prefers-reduced-motion: reduce) { .col, .bar { transition: none; } }
</style>
