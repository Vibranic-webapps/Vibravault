<script setup lang="ts">
import { PenLine, X } from 'lucide-vue-next'
import { transactionLabel } from '~~/shared/utils/merchant'
import { insightsWindow, parseDayKey, type InsightsPeriodKind } from '~~/shared/utils/insights'
import { useTransactionsStore, groupByDay, dayKey, type Transaction } from '~/stores/transactions'
import { useInsightsStore } from '~/stores/insights'
import { useCategoriesStore } from '~/stores/categories'
import { useRulesStore } from '~/stores/rules'
import { UNSORTED_KEY } from '~/utils/ringSlices'

/**
 * Transactions: where did the money go?
 *   Week | Month -> period switcher -> (account chips) -> net verdict + In/Out/Net
 *   -> subscriptions ring -> in-vs-out chart -> category ring -> filter chips
 *   -> the period's rows, grouped by day. Tap a row for the drawer.
 * Picking a category in the ring narrows the list below. Everything follows the
 * same period + account (one fetch for the numbers, one for the list: see
 * stores/insights.ts). Adding happens in the shell's New transaction sheet.
 */
const { t } = useI18n()
const { money, date, monthName } = useFormat()
const { toast } = useToast()
const addTx = useAddTransaction()
const store = useTransactionsStore()
const insights = useInsightsStore()
const categories = useCategoriesStore()
const rules = useRulesStore()

// ---- Period + account ------------------------------------------------------
// Week | Month is remembered in a cookie (like the theme), so the choice sticks.
const periodCookie = useCookie<InsightsPeriodKind>('vv-tx-period', {
  default: () => 'month',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
  path: '/',
})
const period = computed<InsightsPeriodKind>(() => (periodCookie.value === 'week' ? 'week' : 'month'))
const periodOptions = computed(() => [
  { value: 'week', label: t('insights.week') },
  { value: 'month', label: t('insights.month') },
])

// Month mode shares store.month with the rest of the app. Week mode keeps its
// own anchor: any day inside the shown week.
const weekAnchor = ref(dayKey(new Date()))
const week = computed(() => insightsWindow('week', parseDayKey(weekAnchor.value) ?? new Date()))
// Nothing to see in the future: stop at the week that contains today.
const canNextWeek = computed(() => week.value.to < dayKey(new Date()))
/** null = all accounts. */
const accountId = ref<string | null>(null)
/** Picked category (its id, or UNSORTED_KEY): narrows the list below the charts. */
const pickedCategory = ref<string | null>(null)

function load() {
  return insights.fetch({
    kind: period.value,
    anchor: period.value === 'month' ? `${store.month}-01` : weekAnchor.value,
    accountId: accountId.value,
  })
}

// A different period or account has different categories: drop the narrowing.
function moveTo(change: () => void) {
  change()
  pickedCategory.value = null
  load()
}

const month = computed({
  get: () => store.month,
  set: (m: string) => moveTo(() => { store.month = m }),
})
function setPeriod(value: string) {
  moveTo(() => { periodCookie.value = value === 'week' ? 'week' : 'month' })
}
function shiftWeek(anchor: string) {
  moveTo(() => { weekAnchor.value = anchor })
}
function setAccount(id: string | null) {
  moveTo(() => { accountId.value = id })
}

// Opens at once on what the stores already hold, then refreshes (see useScreenData).
useScreenData(() => Promise.all([load(), categories.fetchAll(true), rules.fetchAll()]))

// Something was added / edited / deleted / imported: refresh the whole picture.
watch(() => store.revision, () => { load() })

const data = computed(() => insights.data)
const accounts = computed(() => data.value?.accounts ?? [])
const manyAccounts = computed(() => accounts.value.length >= 2)

// A narrowing that no longer exists in the new numbers would hide everything.
watch(data, (d) => {
  if (!pickedCategory.value || !d) return
  if (!d.categories.some((c) => (c.categoryId ?? UNSORTED_KEY) === pickedCategory.value)) pickedCategory.value = null
})
const pickedName = computed(() => {
  const c = data.value?.categories.find((x) => (x.categoryId ?? UNSORTED_KEY) === pickedCategory.value)
  return c ? (c.name ?? t('insights.unsorted')) : ''
})

// Charts only appear when they have something to say (no zero-rings).
const hasMoney = computed(() => {
  const r = data.value?.ring
  return !!r && (r.incomeCents > 0 || r.subscriptionsCents + r.otherSpendCents > 0)
})
const hasFlow = computed(() => !!data.value?.series.some((b) => b.incomeCents || b.expenseCents))

function categoryOf(id: string | null) {
  return id ? categories.byId.get(id) : undefined
}

// ---- Filters ---------------------------------------------------------------
// A row is exactly one of: transfer (between your own accounts), in, or out.
// "Not sorted" cuts across those.
type Filter = 'all' | 'unsorted' | 'in' | 'out' | 'transfers'
const filter = ref<Filter>('all')

function kindOf(tx: Transaction): 'transfer' | 'in' | 'out' {
  if (categoryOf(tx.categoryId)?.kind === 'TRANSFER') return 'transfer'
  return tx.amountCents > 0 ? 'in' : 'out'
}

function matches(tx: Transaction, f: Filter = filter.value) {
  switch (f) {
    case 'all': return true
    case 'unsorted': return !tx.categoryId
    case 'transfers': return kindOf(tx) === 'transfer'
    default: return kindOf(tx) === f
  }
}

// The rows of this period + account, narrowed by the category picked in the
// ring. That narrowing and the chips below apply together.
const scoped = computed(() =>
  pickedCategory.value === null
    ? insights.items
    : insights.items.filter((tx) => (tx.categoryId ?? UNSORTED_KEY) === pickedCategory.value),
)

const counts = computed(() => {
  const c = { all: 0, unsorted: 0, in: 0, out: 0, transfers: 0 }
  for (const tx of scoped.value) {
    for (const f of Object.keys(c) as Filter[]) if (matches(tx, f)) c[f]++
  }
  return c
})

// Chips with nothing behind them are hidden - a filter that can only ever
// show "nothing here" is noise. "All" always stays.
const chips = computed(() => ([
  { key: 'all', label: t('tx.all') },
  { key: 'unsorted', label: t('tx.unsorted') },
  { key: 'in', label: t('tx.in') },
  { key: 'out', label: t('tx.out') },
  { key: 'transfers', label: t('tx.transfers') },
] as { key: Filter; label: string }[]).filter((c) => c.key === 'all' || counts.value[c.key] > 0))

// New period has none of the filtered kind? Fall back to All instead of an
// empty screen you didn't ask for.
watch(counts, (c) => { if (filter.value !== 'all' && !c[filter.value]) filter.value = 'all' })

// ---- The list, grouped by day ---------------------------------------------
const days = computed(() =>
  groupByDay(scoped.value)
    .map(([day, rows]) => {
      const shown = rows.filter((tx) => matches(tx))
      // Day total counts real money only: transfers stay out, like the tiles.
      const total = shown.filter((tx) => kindOf(tx) !== 'transfer').reduce((n, tx) => n + tx.amountCents, 0)
      return { day, rows: shown, total }
    })
    .filter((d) => d.rows.length),
)

function dayTitle(day: string) {
  return date(day, { weekday: 'long', day: 'numeric', month: 'long' })
}

/** Account tag for a row: only where it adds something (2+ accounts). */
function accountNameFor(tx: Transaction): string | null {
  if (!manyAccounts.value) return null
  // One account picked: the tag would repeat the obvious, but a transfer still needs its direction.
  if (kindOf(tx) !== 'transfer' && accountId.value) return null
  return accounts.value.find((a) => a.id === tx.accountId)?.name ?? null
}

// ---- Drawer + rules --------------------------------------------------------
const viewing = ref<Transaction | null>(null)
const teaching = ref<Transaction | null>(null)

async function onRemove(tx: Transaction) {
  viewing.value = null
  if (!confirm(t('tx.deleteConfirm'))) return
  if (await store.remove(tx.id)) toast(t('tx.deleted'))
}

async function onRuleSaved(n: number) {
  teaching.value = null
  toast(t('tx.ruleSaved', n))
  await Promise.all([load(), rules.fetchAll()])
}

// Pull to refresh (also the retry for a failed load): refetch the period being
// viewed and what feeds the rows. The stores swallow their errors into `.error`, so check them.
onPullRefresh(async () => {
  await Promise.all([load(), categories.fetchAll(true), rules.fetchAll()])
  if (insights.error || categories.error || rules.error) throw new Error('refresh failed')
})
</script>

<template>
  <div>
    <h1>{{ t('tx.title') }}</h1>

    <UiSegmented class="period" :model-value="period" :options="periodOptions" :label="t('insights.periodLabel')" @update:model-value="setPeriod" />

    <UiMonthSwitcher v-if="period === 'month'" v-model="month" class="months" />
    <InsightsWeekSwitcher
      v-else
      class="months"
      :from="week.from"
      :to="week.to"
      :can-next="canNextWeek"
      @prev="shiftWeek(week.prevAnchor)"
      @next="shiftWeek(week.nextAnchor)"
    />

    <!-- Invisible (renders nothing) until there are two accounts. -->
    <InsightsAccountSwitch :accounts="accounts" :model-value="accountId" @update:model-value="setAccount" />

    <div class="body" :class="{ refreshing: insights.loading }" :aria-busy="insights.loading">
      <div v-if="insights.error || store.error" class="vv-error err" role="alert">
        <p>{{ insights.error || store.error }}</p>
        <UiButton variant="ghost" :block="false" @click="load()">{{ t('common.retry') }}</UiButton>
      </div>

      <!-- First load only: placeholders the size of what comes, so nothing jumps. -->
      <template v-if="!insights.loaded && !insights.error">
        <div class="neu-3 skeleton verdict-sk" aria-hidden="true" />
        <div class="neu-3 skeleton ring-sk" aria-hidden="true" />
      </template>

      <!-- Empty period: no charts, no zero-rings -->
      <section v-else-if="insights.loaded && !insights.items.length" class="neu-3 empty">
        <p v-if="period === 'month'">{{ t('home.emptyMonth', { month: monthName(month) }) }}</p>
        <p v-else>{{ t('insights.emptyWeek') }}</p>
        <UiButton :icon="PenLine" :block="false" @click="addTx.show()">{{ t('tx.addFirst') }}</UiButton>
      </section>

      <template v-else-if="data">
        <InsightsNetVerdict
          class="block"
          :income-cents="data.totals.incomeCents"
          :expense-cents="data.totals.expenseCents"
          :net-cents="data.totals.netCents"
        />
        <MoneyTiles class="tiles" :income="data.totals.incomeCents" :expense="data.totals.expenseCents" :net="data.totals.netCents" />
        <p v-if="data.totals.transferredCents" class="moved">{{ t('tx.moved', { amount: money(data.totals.transferredCents) }) }}</p>

        <InsightsSpendRing
          v-if="hasMoney"
          class="block"
          :ring="data.ring"
          :subscriptions="data.subscriptions"
          :kind="data.period.kind"
        />
        <InsightsFlowChart
          v-if="hasFlow"
          class="block"
          :series="data.series"
          :kind="data.period.kind"
          :title="t('insights.flowTitle')"
        />
        <InsightsCategoryRing
          v-if="data.categories.length"
          class="block"
          :categories="data.categories"
          :active="pickedCategory"
          @select="(key) => (pickedCategory = key)"
        />

        <!-- Scrolls sideways when the chips don't fit; the screen swipe leaves
             horizontal scrollers alone, so this never switches tabs. -->
        <div class="chips" role="group" :aria-label="t('tx.filters')">
          <UiChip v-if="pickedCategory" active class="clear" @click="pickedCategory = null">
            <X :size="14" aria-hidden="true" />
            {{ t('insights.onlyCategory', { name: pickedName }) }}
          </UiChip>
          <UiChip
            v-for="c in chips"
            :key="c.key"
            :active="filter === c.key"
            :count="c.key === 'all' ? undefined : counts[c.key]"
            @click="filter = c.key"
          >{{ c.label }}</UiChip>
        </div>

        <section v-for="d in days" :key="d.day" class="day">
          <header class="day-head">
            <h2>{{ dayTitle(d.day) }}</h2>
            <span v-if="d.total" class="day-total">{{ money(d.total, { signed: d.total > 0 }) }}</span>
          </header>
          <div class="neu-3 rows">
            <TxRow
              v-for="tx in d.rows"
              :key="tx.id"
              :label="transactionLabel(tx.counterparty, tx.description, rules.items)"
              :sub="categoryOf(tx.categoryId)?.name ?? t('home.unsorted')"
              :booked-at="tx.bookedAt"
              :amount-cents="tx.amountCents"
              :icon="categoryOf(tx.categoryId)?.icon"
              :color="categoryOf(tx.categoryId)?.color"
              :transfer="kindOf(tx) === 'transfer'"
              :account-name="accountNameFor(tx)"
              @click="viewing = tx"
            />
          </div>
        </section>

        <section v-if="!days.length" class="neu-3 empty">
          <p>{{ t('tx.emptyFilter') }}</p>
          <UiButton variant="ghost" :block="false" @click="filter = 'all'; pickedCategory = null">{{ t('tx.showAll') }}</UiButton>
        </section>
      </template>
    </div>

    <TransactionDrawer
      :transaction="viewing"
      :category="categoryOf(viewing?.categoryId ?? null)"
      @close="viewing = null"
      @updated="(tx) => { viewing = tx }"
      @remove="onRemove"
      @teach="(tx) => { viewing = null; teaching = tx }"
    />
    <TeachRuleDialog :transaction="teaching" @close="teaching = null" @saved="onRuleSaved" />
  </div>
</template>

<style scoped>
h1 { margin: 0 0 20px; font-size: 28px; font-weight: 800; letter-spacing: -.01em; }
.period { margin: 0 0 16px; }
.months { margin: 0 0 18px; }
.body { transition: opacity .15s ease; }
.body.refreshing { opacity: .5; }

.block { margin-bottom: 16px; }
.tiles { margin-bottom: 10px; }
.moved { margin: 0 0 16px; text-align: center; font-size: 12px; color: var(--vv-muted); }

.err { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.err p { margin: 0; min-width: 0; overflow-wrap: anywhere; }

/* Placeholder heights ~ the real cards, so the page doesn't jump when data lands. */
.skeleton { margin-bottom: 16px; opacity: .6; }
.verdict-sk { height: 150px; }
.ring-sk { height: 320px; }

/* Padding keeps the chips' shadows inside the scroller (which clips). */
.chips {
  display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none;
  margin: 8px -24px 14px; padding: 8px 24px 12px;
}
.chips::-webkit-scrollbar { display: none; }
.clear { max-width: 70vw; }

.day { margin-bottom: 18px; }
.day-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin: 0 4px 10px; }
.day-head h2 { margin: 0; font-size: 13px; font-weight: 700; color: var(--vv-muted); }
.day-head h2::first-letter { text-transform: uppercase; }
.day-total { font-size: 13px; font-weight: 600; color: var(--vv-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.rows { padding: 2px 16px; }

.empty { padding: 30px 22px; text-align: center; }
.empty p { margin: 0 0 16px; color: var(--vv-muted); font-size: 15px; }

@media (max-width: 560px) { .chips { margin: 8px -18px 14px; padding: 8px 18px 12px; } }
@media (prefers-reduced-motion: reduce) { .body { transition: none; } }
</style>
