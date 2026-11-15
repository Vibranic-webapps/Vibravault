import { defineStore } from 'pinia'
import { insightsWindow, parseDayKey, type InsightsPeriodKind } from '~~/shared/utils/insights'
import type { Transaction } from '~/stores/transactions'

/** What GET /api/transactions/insights sends back (see server/api/transactions/insights.get.ts). */
export interface InsightsData {
  period: { kind: InsightsPeriodKind; from: string; to: string; prevAnchor: string; nextAnchor: string }
  totals: { incomeCents: number; expenseCents: number; netCents: number; transferredCents: number; count: number }
  subscriptions: { totalCents: number; items: { label: string; totalCents: number; count: number }[] }
  ring: { incomeCents: number; subscriptionsCents: number; otherSpendCents: number; leftCents: number; overCents: number }
  series: { key: string; from: string; to: string; label: string; incomeCents: number; expenseCents: number; netCents: number }[]
  categories: { categoryId: string | null; name: string | null; icon: string | null; color: string | null; totalCents: number; isSubscription: boolean }[]
  accounts: { id: string; name: string }[]
  accountId: string | null
}

export interface InsightsQuery {
  kind: InsightsPeriodKind
  /** Any day inside the period (YYYY-MM-DD). Month mode uses the 1st. */
  anchor: string
  accountId: string | null
}

/**
 * The Transactions screen's picture of a period: the insights numbers AND the
 * list rows for the SAME period + account, fetched together so the charts and
 * the list below them can never disagree.
 *
 * Kept apart from the transactions store on purpose: that store's month/items
 * are shared with other screens, and the week view must not disturb them.
 */
export const useInsightsStore = defineStore('insights', () => {
  const data = ref<InsightsData | null>(null)
  const items = ref<Transaction[]>([])
  const loading = ref(false)
  /** True after the first successful fetch: until then "no data" means "not here yet". */
  const loaded = ref(false)
  const error = ref<string | null>(null)
  let lastQuery: InsightsQuery | null = null
  // Only the newest request may write: a slow answer for the previous
  // period must not overwrite the one you're looking at now.
  let seq = 0

  function message(e: unknown): string {
    if (typeof e === 'object' && e && 'statusMessage' in e) {
      const m = (e as { statusMessage?: unknown }).statusMessage
      if (typeof m === 'string') return m
    }
    return e instanceof Error ? e.message : 'Something went wrong'
  }

  /** The list endpoint's query for the same period: a month key, or an inclusive day range. */
  function listQuery(q: InsightsQuery): Record<string, string> {
    const out: Record<string, string> = {}
    if (q.kind === 'month') {
      out.month = q.anchor.slice(0, 7)
    } else {
      const day = parseDayKey(q.anchor)
      if (day) {
        const win = insightsWindow('week', day)
        out.from = win.from
        out.to = win.to
      }
    }
    if (q.accountId) out.accountId = q.accountId
    return out
  }

  /** Fetch a period; with no argument, refetch the last one (after an edit). */
  async function fetch(query: InsightsQuery | null = lastQuery) {
    if (!query) return
    lastQuery = query
    const mine = ++seq
    loading.value = true
    error.value = null
    try {
      const request = useRequestFetch()
      const insightsQuery: Record<string, string> = { period: query.kind, anchor: query.anchor }
      if (query.accountId) insightsQuery.accountId = query.accountId
      const [insights, list] = await Promise.all([
        request<InsightsData>('/api/transactions/insights', { query: insightsQuery }),
        request<{ items: Transaction[] }>('/api/transactions', { query: listQuery(query) }),
      ])
      if (mine !== seq) return
      data.value = insights
      items.value = list.items
      loaded.value = true
    } catch (e: unknown) {
      if (mine === seq) error.value = message(e)
    } finally {
      if (mine === seq) loading.value = false
    }
  }

  return { data, items, loading, loaded, error, fetch }
})
