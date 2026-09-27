<script setup lang="ts">
import { PenLine } from 'lucide-vue-next'
import { transactionLabel } from '~~/shared/utils/merchant'
import { useTransactionsStore, type Transaction } from '~/stores/transactions'
import { useCategoriesStore } from '~/stores/categories'
import { useRulesStore } from '~/stores/rules'

/**
 * Transactions (Redesign v2, Wave 3): month switcher -> In / Out / Net ->
 * filter chips -> the month's rows, grouped by day. Tap a row for the drawer.
 * Adding happens in the shell's New transaction sheet (+ or the empty state).
 */
const { t } = useI18n()
const { money, date, monthName } = useFormat()
const { toast } = useToast()
const addTx = useAddTransaction()
const store = useTransactionsStore()
const categories = useCategoriesStore()
const rules = useRulesStore()

await Promise.all([store.fetchMonth(), categories.fetchAll(true), rules.fetchAll()])

const month = computed({
  get: () => store.month,
  set: (m: string) => { store.fetchMonth(m) },
})

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

const counts = computed(() => {
  const c = { all: 0, unsorted: 0, in: 0, out: 0, transfers: 0 }
  for (const tx of store.items) {
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

// New month has none of the filtered kind? Fall back to All instead of an
// empty screen you didn't ask for.
watch(counts, (c) => { if (filter.value !== 'all' && !c[filter.value]) filter.value = 'all' })

// ---- The list, grouped by day ---------------------------------------------
const days = computed(() =>
  store.byDay
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
  await Promise.all([store.fetchMonth(), rules.fetchAll()])
}
</script>

<template>
  <div>
    <h1>{{ t('tx.title') }}</h1>

    <UiMonthSwitcher v-model="month" class="months" />

    <div class="body" :class="{ refreshing: store.loading }" :aria-busy="store.loading">
      <MoneyTiles class="tiles" :income="store.totals.income" :expense="store.totals.expense" :net="store.totals.net" />
      <p v-if="store.totals.transferred" class="moved">{{ t('tx.moved', { amount: money(store.totals.transferred) }) }}</p>

      <p v-if="store.error" class="vv-error" role="alert">{{ store.error }}</p>

      <!-- Empty month -->
      <section v-if="!store.items.length" class="neu-3 empty">
        <p>{{ t('home.emptyMonth', { month: monthName(month) }) }}</p>
        <UiButton :icon="PenLine" :block="false" @click="addTx.show()">{{ t('tx.addFirst') }}</UiButton>
      </section>

      <template v-else>
        <!-- Scrolls sideways when the chips don't fit; the screen swipe leaves
             horizontal scrollers alone, so this never switches tabs. -->
        <div class="chips" role="group" :aria-label="t('tx.filters')">
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
              @click="viewing = tx"
            />
          </div>
        </section>

        <section v-if="!days.length" class="neu-3 empty">
          <p>{{ t('tx.emptyFilter') }}</p>
          <UiButton variant="ghost" :block="false" @click="filter = 'all'">{{ t('tx.showAll') }}</UiButton>
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
.months { margin: 0 0 18px; }
.body { transition: opacity .15s ease; }
.body.refreshing { opacity: .5; }

.tiles { margin-bottom: 10px; }
.moved { margin: 0 0 8px; text-align: center; font-size: 12px; color: var(--vv-muted); }

/* Padding keeps the chips' shadows inside the scroller (which clips). */
.chips {
  display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none;
  margin: 8px -24px 14px; padding: 8px 24px 12px;
}
.chips::-webkit-scrollbar { display: none; }

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
