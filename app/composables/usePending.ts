/**
 * Transactions shared via the Shortcut that wait for review. Shared state:
 * the review sheet (layout) shows them, Home shows a reminder banner.
 */
export interface PendingRow {
  id: string
  amountCents: number
  bookedAt: string
  label: string
  description: string | null
  /** Suggested by a taught rule; kept when added. */
  categoryId: string | null
}

export const usePending = () => {
  const items = useState<PendingRow[]>('vv-pending', () => [])
  const open = useState<boolean>('vv-pending-open', () => false)

  /** Refetch; with autoOpen, pop the sheet when something is waiting. */
  async function refresh(autoOpen = false) {
    try {
      items.value = await $fetch<PendingRow[]>('/api/pending')
    } catch {
      return // signed out or offline: nothing to review right now
    }
    if (autoOpen && items.value.length) open.value = true
  }

  return { items, open, refresh }
}
