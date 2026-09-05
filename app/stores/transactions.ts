import { defineStore } from 'pinia'

export interface Transaction {
  id: string
  /** Signed integer cents. Negative = expense. */
  amountCents: number
  bookedAt: string
  categoryId: string | null
  counterparty: string | null
  description: string | null
  source: 'MANUAL' | 'CSV' | 'PSD2'
}

export interface Totals {
  income: number
  expense: number
  net: number
  count: number
}

export interface TransactionInput {
  amount: string
  bookedAt: string
  categoryId: string | null
  counterparty: string | null
  description: string | null
}

/** "2026-09" for a Date - the month key the API filters on. */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export const useTransactionsStore = defineStore('transactions', () => {
  // State
  const items = ref<Transaction[]>([])
  const totals = ref<Totals>({ income: 0, expense: 0, net: 0, count: 0 })
  const month = ref<string>(monthKey(new Date()))
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  /** Rows grouped by calendar day, newest first - how the list renders. */
  const byDay = computed(() => {
    const groups = new Map<string, Transaction[]>()
    for (const t of items.value) {
      const day = t.bookedAt.slice(0, 10)
      const list = groups.get(day)
      if (list) list.push(t)
      else groups.set(day, [t])
    }
    return [...groups.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  })

  const uncategorisedCount = computed(() => items.value.filter((t) => !t.categoryId).length)

  // Actions
  function message(e: unknown): string {
    if (typeof e === 'object' && e && 'statusMessage' in e) {
      const m = (e as { statusMessage?: unknown }).statusMessage
      if (typeof m === 'string') return m
    }
    return e instanceof Error ? e.message : 'Something went wrong'
  }

  async function fetchMonth(m: string = month.value) {
    month.value = m
    loading.value = true
    error.value = null
    try {
      const res = await useRequestFetch()<{ items: Transaction[]; totals: Totals }>(
        '/api/transactions',
        { query: { month: m } },
      )
      items.value = res.items
      totals.value = res.totals
    } catch (e: unknown) {
      error.value = message(e)
    } finally {
      loading.value = false
    }
  }

  function shiftMonth(delta: number) {
    const [y, m] = month.value.split('-').map(Number)
    const d = new Date(y!, m! - 1 + delta, 1)
    return fetchMonth(monthKey(d))
  }

  async function create(input: TransactionInput) {
    error.value = null
    try {
      await $fetch('/api/transactions', { method: 'POST', body: input })
      await fetchMonth()
      return true
    } catch (e: unknown) {
      error.value = message(e)
      return false
    }
  }

  async function update(id: string, input: TransactionInput) {
    error.value = null
    try {
      await $fetch(`/api/transactions/${id}`, { method: 'PATCH', body: input })
      await fetchMonth()
      return true
    } catch (e: unknown) {
      error.value = message(e)
      return false
    }
  }

  async function remove(id: string) {
    error.value = null
    try {
      await $fetch(`/api/transactions/${id}`, { method: 'DELETE' })
      await fetchMonth()
      return true
    } catch (e: unknown) {
      error.value = message(e)
      return false
    }
  }

  return {
    items, totals, month, loading, error,
    byDay, uncategorisedCount,
    fetchMonth, shiftMonth, create, update, remove,
  }
})
