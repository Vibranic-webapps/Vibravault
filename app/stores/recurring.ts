import { defineStore } from 'pinia'

/**
 * Recurring payments + bills. An ITEM is the rule ("Netflix, every month on the 14th");
 * an OCCURRENCE (Occ) is one due date of it, with a state the server derives.
 * Amounts are integer cents, ABSOLUTE values (the direction carries the sign).
 */
export type RecurringCadence = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
export type RecurringDirection = 'IN' | 'OUT'
export type OccState = 'paid' | 'markedPaid' | 'skipped' | 'overdue' | 'dueSoon' | 'upcoming'

export interface Occ {
  dueOn: string
  state: OccState
  paidOn: string | null
  transactionId: string | null
  /** Negative when the due date is already past. */
  daysUntil: number
}

export interface RecurringItem {
  id: string
  name: string
  match: string
  amountMinCents: number
  amountMaxCents: number
  direction: RecurringDirection
  cadence: RecurringCadence
  anchorOn: string
  categoryId: string | null
  accountId: string | null
  active: boolean
  category: { id: string; name: string; icon: string; color: string } | null
  /** The earliest occurrence still open; null when paused. */
  next: Occ | null
  /** The most recent settled occurrence (paid, marked paid or skipped). */
  last: Occ | null
}

export interface RecurringInput {
  name: string
  match: string
  amountMinCents: number
  amountMaxCents: number
  direction: RecurringDirection
  cadence: RecurringCadence
  anchorOn: string
  categoryId?: string | null
  accountId?: string | null
  active?: boolean
}

/** What a failed request tells us: a stable code (RECURRING_*) and the form field it is about. */
export interface RecurringFailure {
  code: string | null
  field: string | null
  status: number | null
}

export const useRecurringStore = defineStore('recurring', () => {
  const items = ref<RecurringItem[]>([])
  const today = ref<string | null>(null)
  const loading = ref(false)
  const loaded = ref(false)
  /** Set when the LIST could not be loaded (drives the retry state). */
  const error = ref<string | null>(null)
  /** The last failed write (create / update / settle ...), so a form can show it by field. */
  const failure = ref<RecurringFailure | null>(null)

  const byId = computed(() => new Map(items.value.map((i) => [i.id, i])))

  function message(e: unknown): string {
    if (typeof e === 'object' && e && 'statusMessage' in e) {
      const m = (e as { statusMessage?: unknown }).statusMessage
      if (typeof m === 'string') return m
    }
    return e instanceof Error ? e.message : 'Something went wrong'
  }

  function remember(e: unknown) {
    const err = e as { statusCode?: number; data?: { data?: { code?: string; field?: string }; code?: string; field?: string } } | null
    // $fetch errors carry the server's createError data under `data.data`.
    const d = err?.data?.data ?? err?.data
    failure.value = { code: d?.code ?? null, field: d?.field ?? null, status: err?.statusCode ?? null }
  }

  /** After any change the Home "Coming up" card must follow: it lives in the dashboard payload. */
  function refreshHome() {
    if (import.meta.client) refreshNuxtData('dashboard')
  }

  function put(item: RecurringItem) {
    const i = items.value.findIndex((x) => x.id === item.id)
    if (i === -1) items.value = [item, ...items.value]
    else items.value = items.value.map((x) => (x.id === item.id ? item : x))
  }

  async function fetchAll(force = false) {
    if (loaded.value && !force) return
    loading.value = true
    error.value = null
    try {
      const res = await useRequestFetch()<{ today: string; items: RecurringItem[] }>('/api/recurring')
      items.value = res.items
      today.value = res.today
      loaded.value = true
    } catch (e: unknown) {
      error.value = message(e)
    } finally {
      loading.value = false
    }
  }

  /** Returns the new item, or null on failure (see `failure`). */
  async function create(input: RecurringInput): Promise<RecurringItem | null> {
    failure.value = null
    try {
      const item = await $fetch<RecurringItem>('/api/recurring', { method: 'POST', body: input })
      put(item)
      refreshHome()
      return item
    } catch (e: unknown) {
      remember(e)
      return null
    }
  }

  async function update(id: string, patch: Partial<RecurringInput>): Promise<RecurringItem | null> {
    failure.value = null
    try {
      const item = await $fetch<RecurringItem>(`/api/recurring/${id}`, { method: 'PATCH', body: patch })
      put(item)
      refreshHome()
      return item
    } catch (e: unknown) {
      remember(e)
      return null
    }
  }

  async function remove(id: string): Promise<boolean> {
    failure.value = null
    try {
      await $fetch(`/api/recurring/${id}`, { method: 'DELETE' })
      items.value = items.value.filter((i) => i.id !== id)
      refreshHome()
      return true
    } catch (e: unknown) {
      remember(e)
      return false
    }
  }

  /** Skip this time (SKIPPED) or mark it paid / received by hand (MARKED_PAID). */
  async function settle(id: string, dueOn: string, kind: 'SKIPPED' | 'MARKED_PAID'): Promise<RecurringItem | null> {
    failure.value = null
    try {
      const item = await $fetch<RecurringItem>(`/api/recurring/${id}/settle`, { method: 'POST', body: { dueOn, kind } })
      put(item)
      refreshHome()
      return item
    } catch (e: unknown) {
      remember(e)
      return null
    }
  }

  /** Take back a skip / mark-paid. */
  async function unsettle(id: string, dueOn: string): Promise<RecurringItem | null> {
    failure.value = null
    try {
      const item = await $fetch<RecurringItem>(`/api/recurring/${id}/settle`, { method: 'DELETE', query: { dueOn } })
      put(item)
      refreshHome()
      return item
    } catch (e: unknown) {
      remember(e)
      return null
    }
  }

  return { items, today, loading, loaded, error, failure, byId, fetchAll, create, update, remove, settle, unsettle }
})
