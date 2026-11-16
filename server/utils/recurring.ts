import type { Category, RecurringItem } from '@prisma/client'
import { prisma } from './prisma'
import { prismaLive } from './transactionQuery'
import { transferCategoryIds } from './transfers'
import { brusselsDayKey } from '~~/shared/goals'
import { dayKey, parseDayKey } from '~~/shared/utils/insights'
import { validateRuleAmount } from '~~/shared/utils/rules'
import {
  CADENCES, CADENCE_DAYS, DIRECTIONS, addDaysKey, daysBetween, isSettled, matchFetchRange, occurrences,
  type BillState, type Occurrence, type PayTx, type RecurringCadence, type RecurringDirection, type SettlementKind,
} from '~~/shared/utils/recurring'

// Recurring payments + bills: validation, loading and serialisation in ONE
// module; route files stay thin. Money is integer cents (on the ABSOLUTE value,
// the direction carries the sign). Due dates and paid state are DERIVED by the
// pure code in shared/utils/recurring.ts - nothing about an occurrence is stored
// except a manual settlement (skip / mark paid).

export const RECURRING_NAME_MAX = 40
export const RECURRING_MATCH_MIN = 3
export const RECURRING_MATCH_MAX = 80
/** A sanity cap so a runaway client cannot fill the table. */
export const RECURRING_MAX_ITEMS = 200
/** Anchors outside this window are typos, not due dates. */
const ANCHOR_MIN = '2000-01-01'
const ANCHOR_MAX = '2100-12-31'

/** Unsettled overdue bills are looked for this many days back (Home strip + `next`). */
export const OVERDUE_LOOKBACK_DAYS = 45
export const COMING_UP_AHEAD_DAYS = 30
export const COMING_UP_PAID_SHOW_DAYS = 7
export const COMING_UP_MAX = 5

/**
 * Error with a stable machine-readable `code` (+ the offending `field`) next to
 * the English `statusMessage` - the same shape the goals/categories APIs use.
 */
export function recurringError(statusCode: number, statusMessage: string, code: string, field?: string) {
  return createError({ statusCode, statusMessage, data: { code, field } })
}
export const recurringNotFound = () => recurringError(404, 'Recurring item not found', 'RECURRING_NOT_FOUND')

/** "Today" as a day key. Brussels clock: bank dates are Belgian calendar dates stored at UTC midnight. */
export function todayKey(now: Date = new Date()): string {
  return brusselsDayKey(now)
}

// ---- Validation -------------------------------------------------------------

/** The editable fields of an item, validated. */
export interface RecurringFields {
  name: string
  match: string
  amountMinCents: number
  amountMaxCents: number
  direction: RecurringDirection
  cadence: RecurringCadence
  anchorOn: Date
  categoryId: string | null
  accountId: string | null
  active: boolean
}

function asObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw recurringError(400, 'Request body must be a JSON object', 'BODY_INVALID')
  }
  return body as Record<string, unknown>
}

const present = (o: Record<string, unknown>, k: string) => o[k] !== undefined

/**
 * Validate a create (no `current`: name, match, both amounts, direction,
 * cadence and anchorOn are required) or a patch (`current` given: only the keys
 * present change; the rest is kept). The MERGED result is what gets checked, so
 * a patch can never leave an item in a state a create would have refused.
 * Database lookups (does the category/account belong to the user?) are NOT here:
 * see assertOwnedRefs.
 */
export function parseRecurringBody(body: unknown, current?: RecurringFields): RecurringFields {
  const o = asObject(body)

  let name = current?.name
  if (present(o, 'name') || !current) {
    const v = typeof o.name === 'string' ? o.name.replace(/\s+/g, ' ').trim() : ''
    if (!v) throw recurringError(400, 'Name is required', 'RECURRING_NAME_INVALID', 'name')
    if (v.length > RECURRING_NAME_MAX) throw recurringError(400, `Name can be at most ${RECURRING_NAME_MAX} characters`, 'RECURRING_NAME_INVALID', 'name')
    name = v
  }

  let match = current?.match
  if (present(o, 'match') || !current) {
    const v = typeof o.match === 'string' ? o.match.replace(/\s+/g, ' ').trim() : ''
    // Same trap as rules: a match that finds everything must be impossible to CREATE.
    if (v.length < RECURRING_MATCH_MIN) throw recurringError(400, `Match text must be at least ${RECURRING_MATCH_MIN} characters`, 'RECURRING_MATCH_INVALID', 'match')
    if (v.length > RECURRING_MATCH_MAX) throw recurringError(400, 'Match text is too long', 'RECURRING_MATCH_INVALID', 'match')
    match = v
  }

  let amountMinCents = current?.amountMinCents
  let amountMaxCents = current?.amountMaxCents
  if (present(o, 'amountMinCents') || present(o, 'amountMaxCents') || !current) {
    const min = present(o, 'amountMinCents') ? o.amountMinCents : current?.amountMinCents
    const max = present(o, 'amountMaxCents') ? o.amountMaxCents : current?.amountMaxCents
    const a = validateRuleAmount(min, max)
    if (!a.ok) throw recurringError(400, a.message, 'RECURRING_AMOUNT_INVALID', a.field)
    // Unlike a rule, an item always has an amount (an exact bill is min = max).
    if (a.amountMinCents == null || a.amountMaxCents == null) {
      throw recurringError(400, 'Give an amount (an exact amount is the same number twice)', 'RECURRING_AMOUNT_INVALID', 'amountMinCents')
    }
    amountMinCents = a.amountMinCents
    amountMaxCents = a.amountMaxCents
  }

  let direction = current?.direction
  if (present(o, 'direction') || !current) {
    if (!DIRECTIONS.includes(o.direction as RecurringDirection)) {
      throw recurringError(400, 'Direction must be IN or OUT', 'RECURRING_DIRECTION_INVALID', 'direction')
    }
    direction = o.direction as RecurringDirection
  }

  let cadence = current?.cadence
  if (present(o, 'cadence') || !current) {
    if (!CADENCES.includes(o.cadence as RecurringCadence)) {
      throw recurringError(400, 'Cadence must be WEEKLY, BIWEEKLY, MONTHLY, QUARTERLY or YEARLY', 'RECURRING_CADENCE_INVALID', 'cadence')
    }
    cadence = o.cadence as RecurringCadence
  }

  let anchorOn = current?.anchorOn
  if (present(o, 'anchorOn') || !current) {
    const d = parseDayKey(o.anchorOn)
    if (!d || dayKey(d) < ANCHOR_MIN || dayKey(d) > ANCHOR_MAX) {
      throw recurringError(400, 'anchorOn must be a real date as YYYY-MM-DD', 'RECURRING_ANCHOR_INVALID', 'anchorOn')
    }
    anchorOn = d
  }

  const ref = (key: 'categoryId' | 'accountId'): string | null => {
    if (!present(o, key)) return current?.[key] ?? null
    const v = o[key]
    if (v === null || v === '') return null
    if (typeof v !== 'string') throw recurringError(400, `${key} must be an id or null`, 'RECURRING_REF_INVALID', key)
    return v
  }

  let active = current?.active ?? true
  if (present(o, 'active')) {
    if (typeof o.active !== 'boolean') throw recurringError(400, 'active must be true or false', 'RECURRING_ACTIVE_INVALID', 'active')
    active = o.active
  }

  return {
    name: name!, match: match!, amountMinCents: amountMinCents!, amountMaxCents: amountMaxCents!,
    direction: direction!, cadence: cadence!, anchorOn: anchorOn!,
    categoryId: ref('categoryId'), accountId: ref('accountId'), active,
  }
}

/** The category and account must belong to THIS user; the category kind must fit the direction. */
export async function assertOwnedRefs(userId: string, f: Pick<RecurringFields, 'categoryId' | 'accountId' | 'direction'>) {
  if (f.categoryId) {
    const cat = await prisma.category.findFirst({ where: { id: f.categoryId, userId }, select: { kind: true } })
    if (!cat) throw recurringError(400, 'Unknown category', 'RECURRING_CATEGORY_UNKNOWN', 'categoryId')
    const fits = f.direction === 'OUT' ? cat.kind === 'EXPENSE' : cat.kind === 'INCOME'
    if (!fits) {
      throw recurringError(
        400,
        f.direction === 'OUT' ? 'A bill needs an expense category' : 'Money coming in needs an income category',
        'RECURRING_CATEGORY_KIND', 'categoryId',
      )
    }
  }
  if (f.accountId) {
    const acc = await prisma.account.findFirst({ where: { id: f.accountId, userId }, select: { id: true } })
    if (!acc) throw recurringError(400, 'Unknown account', 'RECURRING_ACCOUNT_UNKNOWN', 'accountId')
  }
}

export function fieldsOf(item: RecurringItem): RecurringFields {
  return {
    name: item.name, match: item.match, amountMinCents: item.amountMinCents, amountMaxCents: item.amountMaxCents,
    direction: item.direction, cadence: item.cadence, anchorOn: item.anchorOn,
    categoryId: item.categoryId, accountId: item.accountId, active: item.active,
  }
}

/** The item, only if it is THIS user's (or null). */
export function findOwnedItem(userId: string, id: string) {
  return prisma.recurringItem.findFirst({ where: { id, userId } })
}

// ---- Loading ----------------------------------------------------------------

/**
 * Live (not soft-deleted) bank rows in a day range, in the shape matching
 * needs. Transfer-category rows are flagged so they can never pay a bill.
 */
export async function loadMatchTransactions(
  userId: string, from: string, to: string, transfers?: Promise<Set<string>>,
): Promise<PayTx[]> {
  // Rows and transfer-category ids load in parallel (one round trip).
  const [rows, t] = await Promise.all([
    prismaLive.transaction.findMany({
      where: { userId, bookedAt: { gte: parseDayKey(from)!, lte: parseDayKey(to)! } },
      select: { id: true, amountCents: true, bookedAt: true, description: true, counterparty: true, categoryId: true },
    }),
    transfers ?? transferCategoryIds(userId),
  ])
  return rows.map((r) => ({
    id: r.id, bookedAt: r.bookedAt, amountCents: r.amountCents, description: r.description,
    counterparty: r.counterparty, isTransfer: r.categoryId != null && t.has(r.categoryId),
  }))
}

// ---- Serialisation: the list / single item view --------------------------------

export interface OccurrenceView {
  dueOn: string
  state: BillState
  paidOn: string | null
  transactionId: string | null
  /** Whole days from today to dueOn (negative = in the past), on the server's Brussels clock. */
  daysUntil: number
}

export interface RecurringItemView {
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
  /** The earliest occurrence still open (overdue up to 45 days back, else the next one coming). null when paused. */
  next: OccurrenceView | null
  /** The most recent settled occurrence (paid / markedPaid / skipped). null when none or paused. */
  last: OccurrenceView | null
}

const occView = (o: Occurrence, today: string): OccurrenceView => ({
  dueOn: o.dueOn, state: o.state, paidOn: o.paidOn, transactionId: o.transactionId, daysUntil: daysBetween(today, o.dueOn),
})

/**
 * Items -> views with their derived `next` / `last`. Four reads in parallel
 * (bank rows, settlements, categories, transfer ids) no matter how many items.
 */
export async function viewItems(userId: string, items: RecurringItem[], today: string = todayKey()): Promise<RecurringItemView[]> {
  if (!items.length) return []

  const ranges = items.map((i) => ({
    from: addDaysKey(today, -(CADENCE_DAYS[i.cadence] + OVERDUE_LOOKBACK_DAYS)),
    to: addDaysKey(today, CADENCE_DAYS[i.cadence] + 7),
  }))
  const fetchFrom = matchFetchRange(ranges.reduce((a, r) => (r.from < a ? r.from : a), ranges[0]!.from), today).from
  // No bank row is booked in the future; two weeks of slack covers hand-typed rows.
  const fetchTo = addDaysKey(today, 14)

  const catIds = [...new Set(items.map((i) => i.categoryId).filter((c): c is string => !!c))]
  const [transactions, settlements, cats] = await Promise.all([
    loadMatchTransactions(userId, fetchFrom, fetchTo),
    prisma.recurringSettlement.findMany({ where: { userId, recurringItemId: { in: items.map((i) => i.id) } } }),
    catIds.length
      ? prisma.category.findMany({ where: { userId, id: { in: catIds } }, select: { id: true, name: true, icon: true, color: true } })
      : Promise.resolve([]),
  ])
  const catById = new Map(cats.map((c) => [c.id, c]))

  const views = items.map((item, idx): RecurringItemView => {
    const range = ranges[idx]!
    const near = matchFetchRange(range.from, range.to)
    const occs = occurrences(item, range, {
      today,
      transactions: transactions.filter((t) => dayKey(t.bookedAt as Date) >= near.from && dayKey(t.bookedAt as Date) <= near.to),
      settlements: settlements.filter((s) => s.recurringItemId === item.id),
    })
    const oldestOpen = addDaysKey(today, -OVERDUE_LOOKBACK_DAYS)
    const next = occs.find((o) => o.dueOn >= oldestOpen && !isSettled(o.state))
    const last = [...occs].reverse().find((o) => isSettled(o.state))
    return {
      id: item.id, name: item.name, match: item.match,
      amountMinCents: item.amountMinCents, amountMaxCents: item.amountMaxCents,
      direction: item.direction, cadence: item.cadence, anchorOn: dayKey(item.anchorOn),
      categoryId: item.categoryId, accountId: item.accountId, active: item.active,
      category: item.categoryId ? catById.get(item.categoryId) ?? null : null,
      next: next ? occView(next, today) : null,
      last: last ? occView(last, today) : null,
    }
  })

  // Active items first, then by what is due soonest (overdue naturally first), then by name.
  return views.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1
    const an = a.next?.dueOn ?? '9999-12-31'
    const bn = b.next?.dueOn ?? '9999-12-31'
    return an < bn ? -1 : an > bn ? 1 : a.name.localeCompare(b.name)
  })
}

export async function viewItem(userId: string, item: RecurringItem): Promise<RecurringItemView> {
  return (await viewItems(userId, [item]))[0]!
}

// ---- Home: "Coming up" ------------------------------------------------------

export interface ComingUpEntry {
  itemId: string
  name: string
  direction: RecurringDirection
  dueOn: string
  expectedMinCents: number
  expectedMaxCents: number
  state: BillState
  paidOn: string | null
  transactionId: string | null
  daysUntil: number
  categoryId: string | null
  icon: string | null
  color: string | null
}

/**
 * The Home "Coming up" list: ACTIVE bills only (direction OUT; income lives on
 * the Recurring page for now), ONE entry per item, at most COMING_UP_MAX.
 *
 * Per item the relevant occurrence is, in this order: the earliest overdue one
 * (up to 45 days back) -> the next one if it is due within 3 days -> a bill paid
 * in the last 7 days -> the next open one (up to 30 days ahead). Sorted overdue
 * first, then soonest, then paid ones (newest first); skipped ones never show.
 *
 * Query budget: 1 read for the items; when there are any, ONE bounded read of
 * bank rows + one of settlements (+ categories / transfer ids, which the
 * dashboard already has and passes in as promises).
 */
export async function loadComingUp(
  userId: string,
  today: string,
  shared?: { categories: Promise<Category[]>; transfers: Promise<Set<string>> },
): Promise<ComingUpEntry[]> {
  const items = await prisma.recurringItem.findMany({ where: { userId, active: true, direction: 'OUT' } })
  if (!items.length) return []

  const from = addDaysKey(today, -OVERDUE_LOOKBACK_DAYS)
  const to = addDaysKey(today, COMING_UP_AHEAD_DAYS)
  const fetch = matchFetchRange(from, to)

  const [transactions, settlements, cats] = await Promise.all([
    loadMatchTransactions(userId, fetch.from, addDaysKey(today, 14), shared?.transfers),
    prisma.recurringSettlement.findMany({
      where: { userId, recurringItemId: { in: items.map((i) => i.id) }, dueOn: { gte: parseDayKey(from)!, lte: parseDayKey(to)! } },
    }),
    shared?.categories ?? prisma.category.findMany({ where: { userId } }),
  ])
  const catById = new Map(cats.map((c) => [c.id, c]))

  const picked: { entry: ComingUpEntry; rank: number }[] = []
  for (const item of items) {
    const occs = occurrences(item, { from, to }, {
      today, transactions, settlements: settlements.filter((s) => s.recurringItemId === item.id),
    })
    const overdue = occs.find((o) => o.state === 'overdue')
    const open = occs.find((o) => o.state === 'dueSoon' || o.state === 'upcoming')
    const recentPaid = [...occs].reverse().find((o) =>
      (o.state === 'paid' || o.state === 'markedPaid') && (o.paidOn ?? o.dueOn) >= addDaysKey(today, -COMING_UP_PAID_SHOW_DAYS))
    const pick = overdue ?? (open?.state === 'dueSoon' ? open : null) ?? recentPaid ?? open
    if (!pick) continue

    const cat = item.categoryId ? catById.get(item.categoryId) : undefined
    picked.push({
      rank: pick.state === 'overdue' ? 0 : isSettled(pick.state) ? 2 : 1,
      entry: {
        itemId: item.id, name: item.name, direction: item.direction, dueOn: pick.dueOn,
        expectedMinCents: item.amountMinCents, expectedMaxCents: item.amountMaxCents,
        state: pick.state, paidOn: pick.paidOn, transactionId: pick.transactionId,
        daysUntil: daysBetween(today, pick.dueOn),
        categoryId: item.categoryId, icon: cat?.icon ?? null, color: cat?.color ?? null,
      },
    })
  }

  return picked
    .sort((a, b) => a.rank - b.rank
      || (a.rank === 2 ? (a.entry.dueOn < b.entry.dueOn ? 1 : a.entry.dueOn > b.entry.dueOn ? -1 : 0)
        : (a.entry.dueOn < b.entry.dueOn ? -1 : a.entry.dueOn > b.entry.dueOn ? 1 : 0))
      || a.entry.name.localeCompare(b.entry.name))
    .slice(0, COMING_UP_MAX)
    .map((p) => p.entry)
}

