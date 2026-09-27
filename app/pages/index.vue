<script setup lang="ts">
import { Inbox, PenLine, FileUp, CircleDashed, ClipboardCheck } from 'lucide-vue-next'
import type { Week } from '~/components/home/WeekChart.vue'
import type { Transaction } from '~/stores/transactions'
import { useTransactionsStore, monthKey, dayKey } from '~/stores/transactions'
import { useCategoriesStore } from '~/stores/categories'
import { useRulesStore } from '~/stores/rules'

/**
 * Home (Redesign v2, Wave 3). Top to bottom, the order you'd ask the questions:
 *   how much do I have?  -> bank card(s)            (all time)
 *   how's this month?    -> In / Out / Net          (month switcher scopes
 *   which week?          -> chart, tap for detail    everything below it)
 *   on what?             -> where it went
 *   what just happened?  -> latest 5, tap for the drawer
 */
interface Account { id: string; name: string; balanceCents: number; fromBank: boolean; asOf: string | null; addedSince: number }
interface TopCategory { id: string | null; name: string | null; icon: string | null; color: string | null; total: number }
interface Dashboard {
  month: string
  balanceCents: number
  accounts: Account[]
  totals: { income: number; expense: number; net: number; count: number }
  weeks: Week[]
  topCategories: TopCategory[]
  latest: (Transaction & { label: string })[]
  uncategorised: number
  hasAnyTransactions: boolean
}

const { t } = useI18n()
const { money, monthName, localeTag } = useFormat()
const addTx = useAddTransaction()
const pending = usePending()
const { toast } = useToast()
const user = useAuthUser()
const txStore = useTransactionsStore()
const categories = useCategoriesStore()
const rules = useRulesStore()

// "Hey Kilian" - or a friendly fallback until a name is set in You.
const greeting = computed(() =>
  user.value?.name ? t('home.greeting', { name: user.value.name }) : t('home.greetingNoName'),
)

const month = ref(monthKey(new Date()))

// Categories + rules feed the drawer (names, tiles, rule labels).
const [{ data, refresh, status }] = await Promise.all([
  useAsyncData<Dashboard>(
    'dashboard',
    () => useRequestFetch()('/api/dashboard', { query: { month: month.value } }),
    { watch: [month] },
  ),
  categories.fetchAll(),
  rules.fetchAll(),
])

// Refetch keeps the frame: while the next month loads, the current one stays
// on screen, dimmed - no blank flash, no layout jump.
const refreshing = computed(() => status.value === 'pending' && !!data.value)
const hasData = computed(() => (data.value?.totals.count ?? 0) > 0)

function shiftMonth(delta: number) {
  const [y, m] = month.value.split('-').map(Number)
  month.value = monthKey(new Date(y!, m! - 1 + delta, 1))
}

// ---- Chart: which week is picked ------------------------------------------
// Viewing the current month? Start on this week. Another month? Nothing
// picked - the hint invites a tap.
const week = ref<string | null>(null)
watch(
  () => data.value?.month,
  () => {
    const today = dayKey(new Date())
    week.value = data.value?.weeks.find((w) => w.from <= today && today <= w.to)?.weekStart ?? null
  },
  { immediate: true },
)

// ---- Where it went ------------------------------------------------------
const pct = computed(() => new Intl.NumberFormat(localeTag.value, { style: 'percent', maximumFractionDigits: 0 }))
function share(total: number) {
  const all = data.value?.totals.expense ?? 0
  return all ? total / all : 0
}

// ---- Latest + the drawer -------------------------------------------------
const viewing = ref<Transaction | null>(null)
const teaching = ref<Transaction | null>(null)

function categoryOf(id: string | null) {
  return id ? categories.byId.get(id) : undefined
}

async function onRemove(tx: Transaction) {
  viewing.value = null
  if (!confirm(t('tx.deleteConfirm'))) return
  if (await txStore.remove(tx.id)) {
    toast(t('tx.deleted'))
    await refresh()
  }
}

async function onRuleSaved(n: number) {
  teaching.value = null
  toast(t('tx.ruleSaved', n))
  await Promise.all([refresh(), rules.fetchAll()])
}
</script>

<template>
  <div>
    <h1 class="hello">{{ greeting }}</h1>

    <!-- Shortcut transactions waiting for review ("Later" was tapped). -->
    <section v-if="pending.items.value.length" class="neu-3 card rows review">
      <UiListRow
        :icon="ClipboardCheck"
        :label="t('review.banner', pending.items.value.length)"
        chevron
        @click="pending.open.value = true"
      />
    </section>

    <!-- First run: a card of €0,00 over an empty chart reads as broken, not
         as new. Show a welcome instead until there's something to show. -->
    <section v-if="data && !data.hasAnyTransactions" class="neu-4 welcome">
      <p class="w-eyebrow">{{ t('home.welcomeEyebrow') }}</p>
      <h2 class="w-title">{{ t('home.welcomeTitle') }}</h2>
      <p class="w-body">{{ t('home.welcomeBody') }}</p>
      <div class="w-actions">
        <UiButton :icon="FileUp" to="/import">{{ t('add.import') }}</UiButton>
        <UiButton :icon="PenLine" variant="ghost" @click="addTx.show()">{{ t('add.manual') }}</UiButton>
      </div>
    </section>

    <template v-else-if="data">
      <HomeCardCarousel :cards="data.accounts" />

      <UiMonthSwitcher v-model="month" class="months" />

      <div class="month-body" :class="{ refreshing }" :aria-busy="refreshing">
        <MoneyTiles class="tiles" :income="data.totals.income" :expense="data.totals.expense" :net="data.totals.net" />

        <section v-if="data.uncategorised" class="neu-3 card rows">
          <UiListRow
            :icon="Inbox"
            :label="t('home.toSort', data.uncategorised)"
            to="/transactions"
          />
        </section>

        <section class="neu-3 card">
          <HomeWeekChart v-if="hasData" v-model:selected="week" :weeks="data.weeks" :title="t('home.weeks')" />
          <div v-else class="empty">
            <h2>{{ t('home.weeks') }}</h2>
            <p>{{ t('home.emptyMonth', { month: monthName(month) }) }}</p>
            <UiButton variant="ghost" :block="false" @click="shiftMonth(-1)">{{ t('home.seePrevious') }}</UiButton>
          </div>
        </section>

        <section v-if="data.topCategories.length" class="neu-3 card">
          <h2>{{ t('home.whereItWent') }}</h2>
          <ul class="cats">
            <li v-for="c in data.topCategories" :key="c.id ?? 'none'" class="cat">
              <span
                class="c-tile neu"
                :style="c.color ? { background: `var(--vv-${c.color})`, color: `var(--vv-${c.color}-fg)` } : {}"
                aria-hidden="true"
              >
                <template v-if="c.icon">{{ c.icon }}</template>
                <CircleDashed v-else :size="18" />
              </span>
              <span class="c-main">
                <span class="c-top">
                  <span class="c-name">{{ c.name ?? t('home.unsorted') }}</span>
                  <span class="vv-amount-out c-amount">{{ money(c.total) }}</span>
                </span>
                <span class="c-bar" :aria-label="t('home.ofSpending', { pct: pct.format(share(c.total)) })">
                  <span :style="{ width: `${Math.max(2, share(c.total) * 100)}%` }" />
                </span>
              </span>
            </li>
          </ul>
        </section>

        <section v-if="data.latest.length" class="neu-3 card">
          <div class="card-head">
            <h2>{{ t('home.latest') }}</h2>
            <NuxtLink class="vv-link see-all" to="/transactions">{{ t('home.seeAll') }}</NuxtLink>
          </div>
          <TxRow
            v-for="tx in data.latest"
            :key="tx.id"
            :label="tx.label"
            :booked-at="tx.bookedAt"
            :amount-cents="tx.amountCents"
            :icon="categoryOf(tx.categoryId)?.icon"
            :color="categoryOf(tx.categoryId)?.color"
            :transfer="categoryOf(tx.categoryId)?.kind === 'TRANSFER'"
            @click="viewing = tx"
          />
        </section>
      </div>
    </template>

    <TransactionDrawer
      :transaction="viewing"
      :category="categoryOf(viewing?.categoryId ?? null)"
      @close="viewing = null"
      @updated="(tx) => { viewing = tx; refresh() }"
      @remove="onRemove"
      @teach="(tx) => { viewing = null; teaching = tx }"
    />
    <TeachRuleDialog :transaction="teaching" @close="teaching = null" @saved="onRuleSaved" />
  </div>
</template>

<style scoped>
.hello { margin: 0 0 20px; font-size: 28px; font-weight: 800; letter-spacing: -.01em; }
h2 { margin: 0 0 14px; font-size: 16px; font-weight: 800; }

.months { margin: 0 0 18px; }
.month-body { transition: opacity .15s ease; }
.month-body.refreshing { opacity: .5; }

.card { padding: 20px; margin-bottom: 18px; }
.rows { padding: 4px 16px; }
.review { margin-bottom: 18px; }
.card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 4px; }
.card-head h2 { margin: 0; }
.see-all { font-size: 14px; }

.tiles { margin-bottom: 18px; }

.empty p { margin: 0 0 14px; color: var(--vv-muted); font-size: 14px; }

/* Where it went: amount + a thin share-of-spending bar per category. One
   series, so no legend - the heading names it. */
.cats { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
.cat { display: flex; align-items: center; gap: 13px; }
.c-tile { display: grid; place-items: center; width: 40px; height: 40px; flex: none; font-size: 17px; color: var(--vv-muted); border-radius: var(--vv-r-sm); }
.c-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 7px; }
.c-top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.c-name { min-width: 0; font-size: 15px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.c-amount { font-size: 15px; font-weight: 700; white-space: nowrap; }
.c-bar { display: block; height: 6px; border-radius: 999px; box-shadow: var(--vv-p1); overflow: hidden; }
.c-bar span { display: block; height: 100%; border-radius: 999px; background: var(--vv-chart-out); }

.welcome { padding: 36px 24px; text-align: center; }
.w-eyebrow { margin: 0 0 6px; font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--vv-accent); }
.w-title { margin: 0 0 8px; font-size: 22px; }
.w-body { margin: 0 auto 24px; max-width: 38ch; font-size: 15px; color: var(--vv-muted); }
.w-actions { display: grid; gap: 12px; max-width: 320px; margin: 0 auto; }

@media (prefers-reduced-motion: reduce) { .month-body { transition: none; } }
</style>
