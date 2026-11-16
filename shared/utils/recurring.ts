/**
 * Recurring payments + bills: the pure maths. No database, no clock, no floats.
 *
 * A RecurringItem is the RULE ("Netflix, 13.99, monthly on the 14th"). A bill
 * is one due occurrence of it. NOTHING about an occurrence is stored: due dates
 * are computed from `anchorOn` + `cadence` (dueDates) and "paid" is derived by
 * matching bank rows (assignPayments / occurrences). Only a manual override
 * ("skip this time", "mark paid") is stored, as a settlement per due date.
 *
 * Dates are plain UTC day keys ("YYYY-MM-DD"), like shared/utils/insights.ts.
 * Known limit (the same as Home): a bank row's bookedAt is a date stored at UTC
 * midnight, and "today" is passed in by the caller (the server uses the
 * Europe/Brussels date). Nothing here reads a clock.
 */
import { ruleMatches } from './rules'

export type RecurringCadence = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
export type RecurringDirection = 'IN' | 'OUT'
export type SettlementKind = 'SKIPPED' | 'MARKED_PAID'
export type BillState = 'paid' | 'markedPaid' | 'skipped' | 'overdue' | 'dueSoon' | 'upcoming'

export const CADENCES: readonly RecurringCadence[] = ['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']
export const DIRECTIONS: readonly RecurringDirection[] = ['IN', 'OUT']

/** A bank row may be booked up to this many days BEFORE the due date... */
export const MATCH_BEFORE_DAYS = 3
/** ...and up to this many days AFTER it (banks book late). Past this, no match = overdue. */
export const MATCH_AFTER_DAYS = 7
/** A due date within this many days (today included) is "dueSoon". */
export const DUE_SOON_DAYS = 3
/**
 * Due dates around a requested range are also computed (and may claim bank
 * rows), so a row that belongs to a neighbour just outside the range is never
 * wrongly given to an occurrence inside it.
 */
export const MATCH_PAD_DAYS = 14

/** Approximate length of one period, for sizing look-back / look-ahead windows. */
export const CADENCE_DAYS: Record<RecurringCadence, number> = {
  WEEKLY: 7,
  BIWEEKLY: 14,
  MONTHLY: 31,
  QUARTERLY: 92,
  YEARLY: 366,
}

// ---- Day keys -------------------------------------------------------------

const DAY_MS = 86_400_000

type DayLike = string | Date

function keyOf(d: DayLike): string {
  return typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10)
}

function dayNum(d: DayLike): number {
  const [y, m, day] = keyOf(d).split('-').map(Number)
  return Math.round(Date.UTC(y!, m! - 1, day!) / DAY_MS)
}

function keyOfNum(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10)
}

/** day key + n days (n may be negative). */
export function addDaysKey(d: DayLike, n: number): string {
  return keyOfNum(dayNum(d) + n)
}

/** whole days from a to b (b - a). */
export function daysBetween(a: DayLike, b: DayLike): number {
  return dayNum(b) - dayNum(a)
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/**
 * The anchor's day-of-month moved forward by `months`, CLAMPED to the target
 * month's length (31 Jan + 1 month = 28/29 Feb; 29 Feb + 12 months = 28 Feb).
 * Always computed from the anchor, never from the previous date, so the day
 * snaps back to 31 in March instead of drifting down to 28 forever.
 */
function addMonthsClamped(anchor: string, months: number): string {
  const [y, m, d] = anchor.split('-').map(Number)
  const total = y! * 12 + (m! - 1) + months
  const ny = Math.floor(total / 12)
  const nm = total - ny * 12 // 0..11
  const daysInMonth = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate()
  return `${String(ny).padStart(4, '0')}-${pad2(nm + 1)}-${pad2(Math.min(d!, daysInMonth))}`
}

// ---- Due dates ------------------------------------------------------------

export interface DueDateRule {
  cadence: RecurringCadence
  anchorOn: DayLike
}

const MAX_DUE_DATES = 5000

/**
 * Every due date of the item inside [from, to] (both inclusive), ascending, as
 * day keys. No date before `anchorOn` is ever returned (an anchor in the future
 * simply means "starts then"). Weekly/biweekly step in days; monthly, quarterly
 * and yearly step in months with month-end clamping.
 */
export function dueDates(item: DueDateRule, from: DayLike, to: DayLike): string[] {
  const f = dayNum(from)
  const t = dayNum(to)
  if (t < f) return []
  const anchor = keyOf(item.anchorOn)
  const a = dayNum(anchor)
  const out: string[] = []

  if (item.cadence === 'WEEKLY' || item.cadence === 'BIWEEKLY') {
    const step = item.cadence === 'WEEKLY' ? 7 : 14
    const k0 = f <= a ? 0 : Math.ceil((f - a) / step)
    for (let n = a + k0 * step; n <= t && out.length < MAX_DUE_DATES; n += step) out.push(keyOfNum(n))
    return out
  }

  const step = item.cadence === 'MONTHLY' ? 1 : item.cadence === 'QUARTERLY' ? 3 : 12
  const [ay, am] = anchor.split('-').map(Number)
  const [fy, fm] = keyOf(from).split('-').map(Number)
  const monthsDiff = fy! * 12 + (fm! - 1) - (ay! * 12 + (am! - 1))
  let k = Math.max(0, Math.floor(monthsDiff / step) - 1)
  for (let guard = 0; guard < MAX_DUE_DATES; guard++, k++) {
    const key = addMonthsClamped(anchor, k * step)
    const n = dayNum(key)
    if (n > t) break
    if (n >= f) out.push(key)
  }
  return out
}

// ---- Matching bank rows to due dates ---------------------------------------

/** The slice of a bank row that matching needs. */
export interface PayTx {
  id: string
  /** The bank date (stored at UTC midnight), as a Date or a day key. */
  bookedAt: DayLike
  /** SIGNED cents: negative = money out. */
  amountCents: number
  description: string | null
  counterparty?: string | null
  /** True when the row's category is a TRANSFER category: moving your own money never pays a bill. */
  isTransfer?: boolean
  /** Soft-deleted rows never match (the server already filters them; this is the second lock). */
  deletedAt?: Date | string | null
}

/** The slice of an item that matching needs (a RecurringItem row fits as-is). */
export interface MatchRule extends DueDateRule {
  match: string
  amountMinCents: number
  amountMaxCents: number
  direction: RecurringDirection
}

function eligible(item: MatchRule, tx: PayTx): boolean {
  if (tx.deletedAt || tx.isTransfer) return false
  // Direction must agree with the sign: a bill is money out, pay is money in.
  if (item.direction === 'OUT' ? tx.amountCents >= 0 : tx.amountCents <= 0) return false
  // The text is searched in counterparty + description. ruleMatches enforces the
  // 3-char minimum, "contains", case/spacing-insensitivity and the absolute
  // amount range: the SAME semantics as a MerchantRule.
  const haystack = `${tx.counterparty ?? ''} | ${tx.description ?? ''}`
  return ruleMatches(item.match, haystack, tx.amountCents, item)
}

/**
 * Which bank row paid which due date. ONE row pays at most ONE occurrence and
 * one occurrence is paid by at most one row. Greedy and deterministic: every
 * (due date, row) pair inside the window is ranked by distance in days, then
 * earlier due date, then earlier row, then row id; the best pair is taken, then
 * the next one that uses neither a taken due date nor a taken row.
 *
 * Returns a map dueOn -> the row that paid it. Due dates without a row are absent.
 */
export function assignPayments(item: MatchRule, dues: string[], txs: PayTx[]): Map<string, PayTx> {
  const rows = txs.filter((tx) => eligible(item, tx)).map((tx) => ({ tx, n: dayNum(tx.bookedAt) }))
  const pairs: { due: string; dn: number; tx: PayTx; tn: number; dist: number }[] = []
  for (const due of dues) {
    const dn = dayNum(due)
    for (const r of rows) {
      const delta = r.n - dn
      if (delta < -MATCH_BEFORE_DAYS || delta > MATCH_AFTER_DAYS) continue
      pairs.push({ due, dn, tx: r.tx, tn: r.n, dist: Math.abs(delta) })
    }
  }
  pairs.sort((x, y) =>
    x.dist - y.dist || x.dn - y.dn || x.tn - y.tn || (x.tx.id < y.tx.id ? -1 : x.tx.id > y.tx.id ? 1 : 0))

  const paid = new Map<string, PayTx>()
  const usedRows = new Set<string>()
  for (const p of pairs) {
    if (paid.has(p.due) || usedRows.has(p.tx.id)) continue
    paid.set(p.due, p.tx)
    usedRows.add(p.tx.id)
  }
  return paid
}

/**
 * The bank row that paid ONE due date, or null. Built on assignPayments over
 * the neighbouring due dates too, so a row that is closer to the next/previous
 * occurrence is not claimed here. Pass every row from about 17 days before to
 * 21 days after the due date for the answer to be complete.
 */
export function matchPayment(item: MatchRule, dueOn: DayLike, txs: PayTx[]): PayTx | null {
  const due = keyOf(dueOn)
  const dues = dueDates(item, addDaysKey(due, -MATCH_PAD_DAYS), addDaysKey(due, MATCH_PAD_DAYS))
  return assignPayments(item, dues, txs).get(due) ?? null
}

/** The day range of bank rows needed to resolve occurrences in [from, to] completely. */
export function matchFetchRange(from: DayLike, to: DayLike): { from: string; to: string } {
  return {
    from: addDaysKey(from, -(MATCH_PAD_DAYS + MATCH_BEFORE_DAYS)),
    to: addDaysKey(to, MATCH_PAD_DAYS + MATCH_AFTER_DAYS),
  }
}

// ---- State of one occurrence ------------------------------------------------

/**
 * paid        a bank row matched (the bank is the truth, even over "mark paid")
 * markedPaid  settled by hand, no bank row
 * skipped     "skip this time" (wins over everything)
 * overdue     past due by more than the late window (7 days), nothing found
 * dueSoon     due today or within 3 days, OR past due but still inside the late
 *             window (the bank may simply not have booked it yet)
 * upcoming    later than that
 */
export function billState(input: {
  dueOn: DayLike
  today: DayLike
  matched: boolean
  settlement?: SettlementKind | null
}): BillState {
  if (input.settlement === 'SKIPPED') return 'skipped'
  if (input.matched) return 'paid'
  if (input.settlement === 'MARKED_PAID') return 'markedPaid'
  const days = daysBetween(input.today, input.dueOn) // > 0 = in the future
  if (days < -MATCH_AFTER_DAYS) return 'overdue'
  if (days <= DUE_SOON_DAYS) return 'dueSoon'
  return 'upcoming'
}

export interface Occurrence {
  dueOn: string
  state: BillState
  /** Bank date of the row that paid it (state 'paid', or 'markedPaid' when a row exists anyway). */
  paidOn: string | null
  transactionId: string | null
  settlement: SettlementKind | null
}

export interface SettlementLike {
  dueOn: DayLike
  kind: SettlementKind
}

/**
 * The occurrences of an item inside [from, to] with their derived state.
 * - paused items (active = false) have none
 * - a SKIPPED date does not claim a bank row; a MARKED_PAID one does, so the
 *   row that arrives later cannot also pay the next occurrence
 * Pass bank rows covering matchFetchRange(from, to).
 */
export function occurrences(
  item: MatchRule & { active: boolean },
  range: { from: DayLike; to: DayLike },
  ctx: { today: DayLike; transactions: PayTx[]; settlements: SettlementLike[] },
): Occurrence[] {
  if (!item.active) return []

  const settled = new Map<string, SettlementKind>()
  for (const s of ctx.settlements) settled.set(keyOf(s.dueOn), s.kind)

  const from = keyOf(range.from)
  const to = keyOf(range.to)
  const padded = dueDates(item, addDaysKey(from, -MATCH_PAD_DAYS), addDaysKey(to, MATCH_PAD_DAYS))
  const claimable = padded.filter((d) => settled.get(d) !== 'SKIPPED')
  const paidBy = assignPayments(item, claimable, ctx.transactions)

  return padded
    .filter((d) => d >= from && d <= to)
    .map((dueOn) => {
      const tx = paidBy.get(dueOn) ?? null
      const settlement = settled.get(dueOn) ?? null
      return {
        dueOn,
        state: billState({ dueOn, today: ctx.today, matched: tx != null, settlement }),
        paidOn: tx ? keyOf(tx.bookedAt) : null,
        transactionId: tx?.id ?? null,
        settlement,
      }
    })
}

/** Settled = nothing left for the user to do about this occurrence. */
export function isSettled(state: BillState): boolean {
  return state === 'paid' || state === 'markedPaid' || state === 'skipped'
}
