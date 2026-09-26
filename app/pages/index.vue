<script setup lang="ts">
import { formatCents } from '~~/shared/utils/money'

interface Week { weekStart: string; label: string; income: number; expense: number }
interface TopCategory { id: string | null; name: string; icon: string; color: string | null; total: number }
interface Dashboard {
  month: string
  balanceCents: number
  totals: { income: number; expense: number; net: number; count: number }
  weeks: Week[]
  topCategories: TopCategory[]
  uncategorised: number
  hasAnyTransactions: boolean
}

const month = ref(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`)

const { data, refresh } = await useAsyncData<Dashboard>(
  'dashboard',
  () => useRequestFetch()('/api/dashboard', { query: { month: month.value } }),
  { watch: [month] },
)

const monthLabel = computed(() => {
  const [y, m] = month.value.split('-').map(Number)
  return new Date(y!, m! - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
})

function shiftMonth(delta: number) {
  const [y, m] = month.value.split('-').map(Number)
  const d = new Date(y!, m! - 1 + delta, 1)
  month.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Scale bars against the largest single value in the window, so week-to-week
// heights are comparable. ONE axis - never a second scale for the second series.
const peak = computed(() => {
  const w = data.value?.weeks ?? []
  return Math.max(1, ...w.map((x) => Math.max(x.income, Math.abs(x.expense))))
})
function barHeight(v: number) { return `${Math.max(v === 0 ? 0 : 2, (Math.abs(v) / peak.value) * 100)}%` }

const hasData = computed(() => (data.value?.totals.count ?? 0) > 0)

// The three tiles are ~110px wide on a phone. "+€ 12.345,67" doesn't fit at a
// fixed 15px, so each value gets its character count as --len and the CSS
// sizes the font to the tile's width (container units) - always one line.
const tiles = computed(() => {
  const t = data.value?.totals
  if (!t) return []
  return [
    { key: 'in', label: 'In', text: formatCents(t.income, { signed: true }), cls: 'in' },
    { key: 'out', label: 'Out', text: formatCents(t.expense), cls: 'out' },
    { key: 'net', label: 'Net', text: formatCents(t.net, { signed: true }), cls: t.net < 0 ? 'out' : 'in' },
  ]
})
const showTable = ref(false)
</script>

<template>
  <div v-if="data">
    <header class="head">
      <div>
        <h1>Dashboard</h1>
        <p class="muted">{{ monthLabel }}</p>
      </div>
      <div class="months">
        <button class="mbtn" type="button" aria-label="Previous month" @click="shiftMonth(-1)">‹</button>
        <button class="mbtn" type="button" aria-label="Next month" @click="shiftMonth(1)">›</button>
      </div>
    </header>

    <!-- First run: a hero of EUR 0,00 over an empty chart reads as broken, not
         as new. Replace the whole dashboard until there is something to show. -->
    <div v-if="!data.hasAnyTransactions" class="neu-4 welcome">
      <p class="w-eyebrow">Welcome</p>
      <h2 class="w-title">Nothing in the vault yet</h2>
      <p class="w-body">
        Import a CSV export from your bank to fill it in one go, or add a transaction by hand.
      </p>
      <div class="w-actions">
        <NuxtLink class="vv-btn w-btn" to="/import">Import a bank CSV</NuxtLink>
        <NuxtLink class="vv-btn vv-btn--ghost w-btn" to="/transactions?new=1">Add one manually</NuxtLink>
      </div>
    </div>

    <template v-else>
    <!-- Hero number: a headline value is NOT a chart. -->
    <div class="neu-4 hero">
      <p class="hero-label">Balance</p>
      <p class="hero-value" :class="data.balanceCents < 0 ? 'neg' : ''">
        {{ formatCents(data.balanceCents) }}
      </p>
      <p class="hero-note">across all transactions</p>
    </div>

    <!-- Stat tiles -->
    <div class="tiles">
      <div v-for="tile in tiles" :key="tile.key" class="neu-3 tile">
        <p class="t-label">{{ tile.label }}</p>
        <p class="t-value" :class="tile.cls" :style="{ '--len': tile.text.length }">{{ tile.text }}</p>
      </div>
    </div>

    <!-- Weekly breakdown -->
    <section class="neu-3 card">
      <div class="card-head">
        <h2>By week</h2>
        <!-- Legend is always present for 2 series: identity is never colour-alone. -->
        <div class="legend">
          <span><i class="sw in" /> In</span>
          <span><i class="sw out" /> Out</span>
        </div>
      </div>

      <p v-if="!hasData" class="empty">
        No transactions in {{ monthLabel }}.
        <button class="linky" type="button" @click="shiftMonth(-1)">Try the previous month</button>
      </p>

      <div v-else class="chart">
        <div v-for="w in data.weeks" :key="w.weekStart" class="week">
          <div class="bars">
            <div
              class="bar in"
              :style="{ height: barHeight(w.income) }"
              :title="`${w.label}: ${formatCents(w.income, { signed: true })} in`"
            />
            <div
              class="bar out"
              :style="{ height: barHeight(w.expense) }"
              :title="`${w.label}: ${formatCents(w.expense)} out`"
            />
          </div>
          <span class="wlabel">{{ w.label }}</span>
        </div>
      </div>

      <button v-if="hasData" class="table-toggle" type="button" @click="showTable = !showTable">
        {{ showTable ? 'Hide' : 'Show' }} the numbers
      </button>

      <!-- Table view: the accessible equivalent of the chart. -->
      <table v-if="showTable && hasData" class="tbl">
        <thead><tr><th>Week</th><th>In</th><th>Out</th></tr></thead>
        <tbody>
          <tr v-for="w in data.weeks" :key="w.weekStart">
            <td>{{ w.label }}</td>
            <td class="num in">{{ formatCents(w.income, { signed: true }) }}</td>
            <td class="num out">{{ formatCents(w.expense) }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Top spending -->
    <section v-if="data.topCategories.length" class="neu-3 card">
      <h2>Where it went</h2>
      <div
        v-for="(c, i) in data.topCategories"
        :key="c.id ?? 'none'"
        class="row"
        :class="{ 'neu-divider': i < data.topCategories.length - 1 }"
      >
        <span
          class="icon neu"
          :style="c.color ? { background: `var(--vv-${c.color})`, color: `var(--vv-${c.color}-fg)` } : {}"
          aria-hidden="true"
        >{{ c.icon }}</span>
        <span class="row-name">{{ c.name }}</span>
        <span class="vv-amount-out">{{ formatCents(c.total) }}</span>
      </div>
    </section>

    <p v-if="data.uncategorised" class="nudge">
      {{ data.uncategorised }} uncategorised this month —
      <NuxtLink class="vv-link" to="/transactions">sort them out</NuxtLink>
    </p>
    </template>
  </div>
</template>

<style scoped>
.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 22px; }
h1 { margin: 0 0 4px; font-size: 26px; }
h2 { margin: 0 0 14px; font-size: 15px; font-weight: 700; }
.muted { margin: 0; color: var(--vv-muted); font-size: 14px; }
.months { display: flex; gap: 8px; }
.mbtn {
  width: 34px; height: 34px; font: inherit; font-size: 17px; line-height: 1;
  color: var(--vv-muted); background: var(--vv-surface);
  border: none; border-radius: var(--vv-r-badge); box-shadow: var(--vv-e1); cursor: pointer;
}
.mbtn:active { box-shadow: var(--vv-p1); }

.hero { padding: 30px; text-align: center; margin-bottom: 20px; }
.hero-label { margin: 0 0 6px; font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--vv-muted); }
.hero-value { margin: 0 0 8px; font-size: 40px; font-weight: 700; font-variant-numeric: tabular-nums; }
.hero-value.neg { color: var(--vv-negative); }
.hero-note { margin: 0; color: var(--vv-muted-2); font-size: 12px; }

.tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
.tile { padding: 16px 8px; text-align: center; container-type: inline-size; min-width: 0; }
.t-label { margin: 0 0 4px; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--vv-muted-2); }
/* One line, always. Font = tile width / (characters x ~0.64em per bold
   tabular glyph), capped at 15px so short amounts don't balloon. */
.t-value {
  margin: 0; white-space: nowrap; font-weight: 700; font-variant-numeric: tabular-nums;
  font-size: clamp(10px, calc(100cqi / (var(--len, 10) * 0.64)), 15px);
}
/* Text wears the SEMANTIC UI tokens; only marks (bars, legend swatches) wear
   the chart tokens. Keeping those two apart is why the chart steps could be
   lifted for legibility without repainting every number in the app. */
.in { color: var(--vv-accent); }
.out { color: var(--vv-negative); }

.card { padding: 22px; margin-bottom: 20px; }
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.card-head h2 { margin: 0; }
.legend { display: flex; gap: 14px; font-size: 12px; color: var(--vv-muted); }
.legend span { display: flex; align-items: center; gap: 6px; }
.sw { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
.legend .sw.in { background: var(--vv-chart-in); }
.legend .sw.out { background: var(--vv-chart-out); }

.chart { display: flex; align-items: flex-end; gap: 10px; height: 150px; padding-top: 6px; }
.week { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; height: 100%; }
.bars {
  flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center;
  gap: 2px; /* 2px surface gap between adjacent bars */
  border-bottom: 1px solid var(--vv-chart-grid);
}
.bar {
  width: 46%; max-width: 26px; min-height: 0;
  border-radius: 4px 4px 0 0;   /* rounded data-end, anchored to the baseline */
  transition: height .25s ease;
}
.bar.in { background: var(--vv-chart-in); }
.bar.out { background: var(--vv-chart-out); }
.wlabel { font-size: 11px; color: var(--vv-muted-2); white-space: nowrap; }

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

.row { display: flex; align-items: center; gap: 13px; padding: 11px 0; }
.icon { display: grid; place-items: center; width: 36px; height: 36px; flex: none; border-radius: var(--vv-r-sm); font-size: 16px; color: var(--vv-muted-2); }
.row-name { flex: 1; font-size: 14px; font-weight: 600; }
.row span:last-child { font-size: 14px; font-weight: 700; }

.empty { margin: 8px 0; color: var(--vv-muted-2); font-size: 14px; }
.linky { padding: 0 0 0 4px; font: inherit; font-size: 14px; font-weight: 600; color: var(--vv-accent); background: none; border: none; cursor: pointer; text-decoration: underline; }

.welcome { padding: 40px 28px; text-align: center; }
.w-eyebrow { margin: 0 0 6px; font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--vv-brand); }
.w-title { margin: 0 0 8px; font-size: 22px; }
.w-body { margin: 0 auto 24px; max-width: 42ch; font-size: 14px; color: var(--vv-muted); }
.w-actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
.w-btn { width: auto; min-width: 190px; text-decoration: none; display: inline-block; text-align: center; }
.nudge { margin: 0 0 10px; font-size: 13px; color: var(--vv-muted); text-align: center; }
</style>
