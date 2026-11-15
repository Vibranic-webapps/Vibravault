/**
 * Transactions insights: the pure maths behind GET /api/transactions/insights.
 *
 * Everything here is integer cents and plain UTC day keys ("YYYY-MM-DD") - no
 * floats, no database, no clock - so server and tests share one definition.
 *
 * Windows are UTC, exactly like server/api/dashboard.get.ts (the agreed known
 * limit: bookedAt is a date, stored at UTC midnight). Don't "fix" to Brussels.
 */

export type InsightsPeriodKind = 'week' | 'month'

const DAY_MS = 86_400_000

/** How many subscription lines the endpoint lists (top by size). */
export const SUBSCRIPTION_ITEMS_MAX = 8

// ---- Day keys -------------------------------------------------------------

/** Strict "YYYY-MM-DD" -> UTC midnight Date, or null when not a real date. */
export function parseDayKey(s: unknown): Date | null {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  const date = new Date(Date.UTC(y!, m! - 1, d!))
  // Date.UTC rolls 2026-02-31 into March - reject anything that didn't round-trip.
  return dayKey(date) === s ? date : null
}

export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS)
}

/** Monday on or before the given day (Monday-start weeks). */
export function mondayOf(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dow = (x.getUTCDay() + 6) % 7 // Mon = 0
  return addDays(x, -dow)
}

// ---- Period window --------------------------------------------------------

export interface InsightsWindow {
  kind: InsightsPeriodKind
  /** First day, inclusive. */
  from: string
  /** Last day, inclusive. */
  to: string
  /** Query bounds: bookedAt >= start && bookedAt < end. */
  start: Date
  end: Date
  /** Any day inside the previous / next period - feed back as ?anchor=. */
  prevAnchor: string
  nextAnchor: string
}

/** week = Mon..Sun around the anchor; month = the calendar month of the anchor. */
export function insightsWindow(kind: InsightsPeriodKind, anchor: Date): InsightsWindow {
  let start: Date
  let end: Date
  let prev: Date
  if (kind === 'week') {
    start = mondayOf(anchor)
    end = addDays(start, 7)
    prev = addDays(start, -7)
  } else {
    start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1))
    end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1))
    prev = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 1, 1))
  }
  return {
    kind,
    from: dayKey(start),
    to: dayKey(addDays(end, -1)),
    start,
    end,
    prevAnchor: dayKey(prev),
    nextAnchor: dayKey(end), // first day of the next period
  }
}

// ---- Buckets (the in-vs-out series) --------------------------------------

export interface InsightsBucket {
  key: string
  from: string
  to: string
  label: string
}

/**
 * week  -> 7 single days (key = the day, label = day of month)
 * month -> Monday-start weeks clipped to the month, same as the dashboard
 *          (key = that week's Monday, which can lie in the previous month).
 */
export function insightsBuckets(win: InsightsWindow): InsightsBucket[] {
  const out: InsightsBucket[] = []
  if (win.kind === 'week') {
    for (let d = new Date(win.start); d < win.end; d = addDays(d, 1)) {
      out.push({ key: dayKey(d), from: dayKey(d), to: dayKey(d), label: String(d.getUTCDate()) })
    }
    return out
  }
  const seen = new Set<string>()
  for (let d = new Date(win.start); d < win.end; d = addDays(d, 1)) {
    const monday = mondayOf(d)
    const key = dayKey(monday)
    if (seen.has(key)) continue
    seen.add(key)
    const sunday = addDays(monday, 6)
    const from = monday < win.start ? win.start : monday
    const lastDay = addDays(win.end, -1)
    const to = sunday > lastDay ? lastDay : sunday
    out.push({ key, from: dayKey(from), to: dayKey(to), label: `${from.getUTCDate()}–${to.getUTCDate()}` })
  }
  return out
}

/** The bucket key a booking date falls into. */
export function insightsBucketKey(kind: InsightsPeriodKind, bookedAt: Date): string {
  return kind === 'week' ? dayKey(bookedAt) : dayKey(mondayOf(bookedAt))
}

// ---- Ring -----------------------------------------------------------------

export interface InsightsRing {
  incomeCents: number
  subscriptionsCents: number
  otherSpendCents: number
  /** Income not spent. 0 when overspent. */
  leftCents: number
  /** Spend beyond income. 0 unless overspent. */
  overCents: number
}

/**
 * Split income into subscriptions / other spending / left.
 * Not overspent: subscriptions + other + left === income, exactly.
 * Overspent (or zero income): left = 0 and over = spend - income.
 * Inputs are non-negative integer cents.
 */
export function insightsRing(incomeCents: number, subscriptionsCents: number, otherSpendCents: number): InsightsRing {
  const spend = subscriptionsCents + otherSpendCents
  const diff = incomeCents - spend
  return {
    incomeCents,
    subscriptionsCents,
    otherSpendCents,
    leftCents: diff > 0 ? diff : 0,
    overCents: diff < 0 ? 0 - diff : 0,
  }
}

// ---- Aggregation ----------------------------------------------------------

export interface InsightsRow {
  amountCents: number
  bookedAt: Date
  categoryId: string | null
  /** Readable name (transactionLabel) - only used for subscription lines. */
  label: string
}

export interface InsightsCategoryInfo {
  id: string
  name: string
  icon: string
  color: string
  isSubscription: boolean
}

/**
 * Everything except `period`, `accounts` and `transferredCents`.
 * `rows` must already be FLOW rows (transfers removed) inside the window.
 */
export function aggregateInsights(
  win: InsightsWindow,
  rows: InsightsRow[],
  categories: InsightsCategoryInfo[],
) {
  const catById = new Map(categories.map((c) => [c.id, c]))

  let income = 0
  let expense = 0
  const buckets = insightsBuckets(win)
  const bucketSums = new Map(buckets.map((b) => [b.key, { income: 0, expense: 0 }]))
  const subLines = new Map<string, { totalCents: number; count: number }>()
  const byCat = new Map<string, number>() // '' = uncategorised; positive cents
  let subscriptions = 0

  for (const t of rows) {
    const bucket = bucketSums.get(insightsBucketKey(win.kind, t.bookedAt))
    if (t.amountCents > 0) {
      income += t.amountCents
      if (bucket) bucket.income += t.amountCents
    } else if (t.amountCents < 0) {
      expense += t.amountCents
      if (bucket) bucket.expense += t.amountCents
      const spent = 0 - t.amountCents
      const cat = t.categoryId ? catById.get(t.categoryId) : undefined
      const catKey = t.categoryId ?? ''
      byCat.set(catKey, (byCat.get(catKey) ?? 0) + spent)
      if (cat?.isSubscription) {
        subscriptions += spent
        const line = subLines.get(t.label) ?? { totalCents: 0, count: 0 }
        line.totalCents += spent
        line.count += 1
        subLines.set(t.label, line)
      }
    }
  }

  const totalSpend = 0 - expense
  const items = [...subLines.entries()]
    .map(([label, v]) => ({ label, totalCents: v.totalCents, count: v.count }))
    .sort((a, b) => b.totalCents - a.totalCents || a.label.localeCompare(b.label))
    .slice(0, SUBSCRIPTION_ITEMS_MAX)

  const categoryRows = [...byCat.entries()]
    .map(([id, totalCents]) => {
      const c = id ? catById.get(id) : undefined
      return {
        categoryId: id || null, // null = uncategorised; the client names it
        name: c?.name ?? null,
        icon: c?.icon ?? null,
        color: c?.color ?? null,
        totalCents,
        isSubscription: c?.isSubscription ?? false,
      }
    })
    .sort((a, b) => b.totalCents - a.totalCents || (a.name ?? '').localeCompare(b.name ?? ''))

  return {
    totals: { incomeCents: income, expenseCents: expense, netCents: income + expense },
    subscriptions: { totalCents: subscriptions, items },
    ring: insightsRing(income, subscriptions, totalSpend - subscriptions),
    series: buckets.map((b) => {
      const s = bucketSums.get(b.key)!
      return { ...b, incomeCents: s.income, expenseCents: s.expense, netCents: s.income + s.expense }
    }),
    categories: categoryRows,
  }
}
