/**
 * Recurring suggestions (phase 1b): find things in the bank history that LOOK
 * recurring ("Apple Services 0,99 every month") so the app can offer "Add it?".
 * The pure maths only: no database, no clock, no floats, nothing is stored.
 * Money is integer cents; dates are plain day keys ("YYYY-MM-DD") like the rest
 * of the recurring code, and "today" is passed in (the server uses Brussels).
 *
 * How a suggestion is found
 *  1. Keep live, non-transfer rows from the last 26 months, grouped by
 *     direction (sign) + merchant. The merchant text is what "Repeats..." would
 *     use as `match` (extractMerchant ?? counterparty ?? label), case and spacing
 *     ignored for grouping.
 *  2. Inside a merchant, split by amount: rows join a cluster while they are
 *     within max(50 cents, 10%) of the cluster's median, so Apple 0,99 and
 *     Apple 4,99 are two candidates.
 *  3. The gaps between consecutive bookings of a cluster must fit ONE cadence
 *     (with tolerance): that, plus similar amounts, is what keeps a weekly shop
 *     with varying baskets from ever being suggested.
 *  4. It must still be alive (last booking within 1.5 cadences of today), must
 *     not be covered by an existing item (active OR paused, same matching as
 *     phase 1) and must not have been dismissed in the last 30 days.
 */
import { addDaysKey, daysBetween, CADENCE_DAYS, type RecurringCadence, type RecurringDirection, type PayTx } from './recurring'
import { extractMerchant, transactionLabel } from './merchant'
import { ruleMatches } from './rules'

type DayLike = string | Date

/** A bank row plus the category info the detector needs. Deleted rows are the caller's job; `deletedAt` is the second lock. */
export interface SuggestionTx extends PayTx {
  categoryId?: string | null
  categoryKind?: 'INCOME' | 'EXPENSE' | 'TRANSFER' | null
}

/** The slice of an existing recurring item that "already tracked" needs (a RecurringItem fits as-is). */
export interface ExistingItemLike {
  match: string
  amountMinCents: number
  amountMaxCents: number
  direction: RecurringDirection
}

export interface DismissalLike {
  key: string
  /** The day (Brussels) of the "Not now" tap. */
  dismissedOn: DayLike
}

export interface Suggestion {
  /** direction|normalisedMerchant|typicalAmountCents - the dismissal key. */
  key: string
  /** Nice label, max 40 chars (same label the transaction list shows). */
  name: string
  /** Bank text to find it (a substring of the rows' counterparty/description), 3..80 chars. */
  match: string
  direction: RecurringDirection
  cadence: RecurringCadence
  /** On the ABSOLUTE value; equal when every booking had the same amount. */
  amountMinCents: number
  amountMaxCents: number
  /** The LAST booking date, like "Repeats..." does. */
  anchorOn: string
  categoryId: string | null
  occurrences: number
  /** Up to the last 3 booking dates, oldest first. */
  seenOn: string[]
}

export const SUGGESTION_MAX = 5
export const SUGGESTION_LOOKBACK_MONTHS = 26
export const SUGGESTION_DISMISS_DAYS = 30
/** Rows join an amount cluster within max(this, CLUSTER_PCT of the median). */
export const CLUSTER_MIN_TOLERANCE_CENTS = 50
export const CLUSTER_PCT = 0.1
/** A suggestion whose last booking is older than this many cadences has stopped. */
export const ALIVE_CADENCES = 1.5
const MATCH_MIN = 3
const MATCH_MAX = 80
const NAME_MAX = 40

/** Allowed gap (days between two bookings), inclusive, per cadence. Disjoint on purpose. */
export const GAP_RANGE: Record<RecurringCadence, readonly [number, number]> = {
  WEEKLY: [6, 8],
  BIWEEKLY: [12, 16],
  MONTHLY: [28, 34],
  QUARTERLY: [85, 96],
  YEARLY: [355, 375],
}
const CADENCE_ORDER: readonly RecurringCadence[] = ['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']
/** Bookings needed before a cadence can be called: yearly needs only 2 (waiting for a third would take years). */
const minOccurrences = (c: RecurringCadence) => (c === 'YEARLY' ? 2 : 3)

const dayKeyOf = (d: DayLike) => addDaysKey(d, 0)
const squash = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()

/** Oldest day a booking may have to count: today minus 26 months (same day of month, clamped). The server bounds its query with it. */
export function suggestionLookbackFrom(today: DayLike): string {
  const [y, m, d] = dayKeyOf(today).split('-').map(Number)
  const total = y! * 12 + (m! - 1) - SUGGESTION_LOOKBACK_MONTHS
  const ny = Math.floor(total / 12)
  const nm = total - ny * 12
  const dim = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate()
  return `${String(ny).padStart(4, '0')}-${String(nm + 1).padStart(2, '0')}-${String(Math.min(d!, dim)).padStart(2, '0')}`
}

export function suggestionKey(direction: RecurringDirection, merchantNorm: string, typicalCents: number): string {
  return `${direction}|${merchantNorm}|${typicalCents}`
}

/** Split a key back up. The merchant may itself contain "|", so cut at the first and the last one. */
export function parseSuggestionKey(key: string): { direction: RecurringDirection; merchant: string; typicalCents: number } | null {
  const first = key.indexOf('|')
  const last = key.lastIndexOf('|')
  if (first < 0 || last <= first) return null
  const direction = key.slice(0, first)
  const typicalCents = Number(key.slice(last + 1))
  if ((direction !== 'IN' && direction !== 'OUT') || !Number.isInteger(typicalCents)) return null
  return { direction, merchant: key.slice(first + 1, last), typicalCents }
}

/** The tolerance around a typical amount, shared by clustering and the dismissal lookup. */
const toleranceOf = (cents: number) => Math.max(CLUSTER_MIN_TOLERANCE_CENTS, cents * CLUSTER_PCT)

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
}

/**
 * The merchant text of a row: what "Repeats..." uses as `match`
 * (extractMerchant ?? counterparty ?? label). It must really occur in the row's
 * own text, or the saved item could never find the row again (e.g. the
 * "Cash deposit" label, a truncated description): such a candidate is skipped
 * and the next one tried; no candidate = the row cannot be suggested.
 */
function merchantOf(tx: SuggestionTx): string | null {
  const hay = `${tx.counterparty ?? ''} | ${tx.description ?? ''}`.replace(/\s+/g, ' ').toLowerCase()
  const candidates = [
    extractMerchant(tx.description ?? ''),
    tx.counterparty,
    transactionLabel(tx.counterparty ?? null, tx.description ?? null),
  ]
  for (const c of candidates) {
    const t = squash(c).slice(0, MATCH_MAX).trim()
    if (t.length >= MATCH_MIN && hay.includes(t.toLowerCase())) return t
  }
  return null
}

interface Row {
  tx: SuggestionTx
  day: string
  abs: number
  direction: RecurringDirection
  merchant: string
  norm: string
}

/** Cluster rows (already one direction + merchant) by amount. */
function clusterByAmount(rows: Row[]): Row[][] {
  const sorted = [...rows].sort((a, b) => a.abs - b.abs)
  const clusters: Row[][] = []
  let cur: Row[] = []
  for (const r of sorted) {
    if (cur.length) {
      const med = median(cur.map((x) => x.abs))
      if (Math.abs(r.abs - med) > toleranceOf(med)) {
        clusters.push(cur)
        cur = []
      }
    }
    cur.push(r)
  }
  if (cur.length) clusters.push(cur)
  return clusters
}

/**
 * Which cadence do these booking days (ascending) follow, if any? Every gap is
 * judged against each cadence's range; the best cadence must fit at least ~80%
 * of the gaps: with 4 or more gaps one bad gap (a skipped month, a very late
 * booking) is forgiven, with fewer every gap must fit.
 */
export function detectCadence(days: string[]): RecurringCadence | null {
  const gaps: number[] = []
  for (let i = 1; i < days.length; i++) gaps.push(daysBetween(days[i - 1]!, days[i]!))
  if (!gaps.length) return null

  let best: { cadence: RecurringCadence; fits: number } | null = null
  for (const cadence of CADENCE_ORDER) {
    if (days.length < minOccurrences(cadence)) continue
    const [lo, hi] = GAP_RANGE[cadence]
    const fits = gaps.filter((g) => g >= lo && g <= hi).length
    const allowedBad = Math.floor(gaps.length / 4)
    if (gaps.length - fits > allowedBad) continue
    if (!best || fits > best.fits) best = { cadence, fits }
  }
  return best?.cadence ?? null
}

/** Is a tracked item already covering this cluster? Same semantics as phase 1 matching (ruleMatches + amountFits on the absolute value). */
function isCovered(rows: Row[], direction: RecurringDirection, existing: ExistingItemLike[]): boolean {
  for (const item of existing) {
    if (item.direction !== direction) continue
    for (const r of rows) {
      const haystack = `${r.tx.counterparty ?? ''} | ${r.tx.description ?? ''}`
      if (ruleMatches(item.match, haystack, r.tx.amountCents, item)) return true
    }
  }
  return false
}

/**
 * Dismissed in the last 30 days? Compared as plain days. The amount part of the
 * key is the cluster's MEDIAN, which can drift by a few cents as new bookings
 * arrive, so a dismissal matches the same direction + merchant with an amount
 * inside the clustering tolerance, not only the exact key.
 */
function isDismissed(direction: RecurringDirection, norm: string, typical: number, dismissals: DismissalLike[], today: string): boolean {
  for (const d of dismissals) {
    if (daysBetween(dayKeyOf(d.dismissedOn), today) >= SUGGESTION_DISMISS_DAYS) continue
    const k = parseSuggestionKey(d.key)
    if (!k || k.direction !== direction || k.merchant !== norm) continue
    if (Math.abs(k.typicalCents - typical) <= toleranceOf(Math.max(k.typicalCents, typical))) return true
  }
  return false
}

/** The most common category among the rows that fits the direction (and is not a transfer); ties go to the most recent. */
function pickCategory(rows: Row[], direction: RecurringDirection): string | null {
  const fitKind = direction === 'OUT' ? 'EXPENSE' : 'INCOME'
  const tally = new Map<string, { n: number; last: string }>()
  for (const r of rows) {
    if (!r.tx.categoryId || r.tx.categoryKind !== fitKind) continue
    const t = tally.get(r.tx.categoryId) ?? { n: 0, last: '' }
    t.n++
    if (r.day > t.last) t.last = r.day
    tally.set(r.tx.categoryId, t)
  }
  let bestId: string | null = null
  let best: { n: number; last: string } | null = null
  for (const [id, t] of tally) {
    if (!best || t.n > best.n || (t.n === best.n && t.last > best.last)) { bestId = id; best = t }
  }
  return bestId
}

export function detectSuggestions(input: {
  transactions: SuggestionTx[]
  existing: ExistingItemLike[]
  dismissals: DismissalLike[]
  today: DayLike
}): Suggestion[] {
  const today = dayKeyOf(input.today)
  const from = suggestionLookbackFrom(today)

  // 1. Usable rows grouped by direction + merchant.
  const groups = new Map<string, Row[]>()
  for (const tx of input.transactions) {
    if (tx.deletedAt || tx.isTransfer || tx.categoryKind === 'TRANSFER') continue
    if (!tx.amountCents) continue
    const day = dayKeyOf(tx.bookedAt)
    if (day < from || day > today) continue
    const merchant = merchantOf(tx)
    if (!merchant) continue
    const direction: RecurringDirection = tx.amountCents < 0 ? 'OUT' : 'IN'
    const norm = merchant.toLowerCase()
    const row: Row = { tx, day, abs: Math.abs(tx.amountCents), direction, merchant, norm }
    const gk = `${direction}|${norm}`
    const list = groups.get(gk)
    if (list) list.push(row)
    else groups.set(gk, [row])
  }

  const out: Suggestion[] = []
  for (const rows of groups.values()) {
    for (const cluster of clusterByAmount(rows)) {
      const sorted = [...cluster].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.tx.id < b.tx.id ? -1 : 1))
      const days = sorted.map((r) => r.day)
      const cadence = detectCadence(days)
      if (!cadence) continue

      const last = sorted[sorted.length - 1]!
      if (daysBetween(last.day, today) > ALIVE_CADENCES * CADENCE_DAYS[cadence]) continue

      const { direction, norm } = last
      if (isCovered(sorted, direction, input.existing)) continue

      const abs = sorted.map((r) => r.abs).sort((a, b) => a - b)
      const typical = median(abs)
      if (isDismissed(direction, norm, typical, input.dismissals, today)) continue

      const label = squash(transactionLabel(last.tx.counterparty ?? null, last.tx.description ?? null))
      out.push({
        key: suggestionKey(direction, norm, typical),
        name: label.length > NAME_MAX ? `${label.slice(0, NAME_MAX - 1).trimEnd()}…` : label,
        match: last.merchant,
        direction,
        cadence,
        amountMinCents: abs[0]!,
        amountMaxCents: abs[abs.length - 1]!,
        anchorOn: last.day,
        categoryId: pickCategory(sorted, direction),
        occurrences: sorted.length,
        seenOn: days.slice(-3),
      })
    }
  }

  return out
    .sort((a, b) =>
      b.occurrences - a.occurrences
      || (a.anchorOn < b.anchorOn ? 1 : a.anchorOn > b.anchorOn ? -1 : 0)
      || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .slice(0, SUGGESTION_MAX)
}
