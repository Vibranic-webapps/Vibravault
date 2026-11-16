import { prisma } from './prisma'
import { prismaLive } from './transactionQuery'
import { recurringError, todayKey } from './recurring'
import { brusselsDayKey } from '~~/shared/goals'
import { parseDayKey } from '~~/shared/utils/insights'
import {
  SUGGESTION_DISMISS_DAYS, detectSuggestions, parseSuggestionKey, suggestionLookbackFrom,
  type Suggestion, type SuggestionTx,
} from '~~/shared/utils/recurringSuggestions'

// Recurring suggestions (phase 1b): loading + the "Not now" write in ONE module;
// the route files stay thin. The detection itself is pure and tested in
// shared/utils/recurringSuggestions.ts. Nothing here creates a recurring item:
// the frontend adds one through the normal POST /api/recurring.

export const SUGGESTION_KEY_MAX = 200
/** Dismissals older than this can no longer hide anything; two spare days cover the Brussels/UTC day edge. */
const DISMISSAL_FETCH_DAYS = SUGGESTION_DISMISS_DAYS + 2

export interface SuggestionsResponse {
  /** The Brussels day the suggestions were computed for. */
  today: string
  suggestions: Suggestion[]
}

/**
 * The suggestions for one user. Four bounded reads in parallel, whatever the
 * history size: live bank rows of the last 26 months (only the needed columns),
 * the user's recurring items (active AND paused: both cover a bill), their
 * categories (kind: transfers never count, a category must fit the direction)
 * and the recent dismissals. Every query is scoped by userId. Empty data gives
 * an empty list, never an error.
 */
export async function loadSuggestions(userId: string, now: Date = new Date()): Promise<SuggestionsResponse> {
  const today = todayKey(now)
  const from = suggestionLookbackFrom(today)

  const [rows, existing, cats, dismissals] = await Promise.all([
    prismaLive.transaction.findMany({
      where: { userId, bookedAt: { gte: parseDayKey(from)!, lte: parseDayKey(today)! } },
      select: { id: true, amountCents: true, bookedAt: true, description: true, counterparty: true, categoryId: true },
    }),
    prisma.recurringItem.findMany({
      where: { userId },
      select: { match: true, amountMinCents: true, amountMaxCents: true, direction: true },
    }),
    prisma.category.findMany({ where: { userId }, select: { id: true, kind: true } }),
    prisma.recurringSuggestionDismissal.findMany({
      where: { userId, dismissedAt: { gte: new Date(now.getTime() - DISMISSAL_FETCH_DAYS * 86_400_000) } },
      select: { key: true, dismissedAt: true },
    }),
  ])

  const kindById = new Map(cats.map((c) => [c.id, c.kind]))
  const transactions: SuggestionTx[] = rows.map((r) => ({
    id: r.id, bookedAt: r.bookedAt, amountCents: r.amountCents, description: r.description,
    counterparty: r.counterparty, categoryId: r.categoryId,
    categoryKind: r.categoryId ? kindById.get(r.categoryId) ?? null : null,
  }))

  const suggestions = detectSuggestions({
    transactions,
    existing,
    // "Not now" is a calendar-day rule, so the timestamp is reduced to its Brussels day.
    dismissals: dismissals.map((d) => ({ key: d.key, dismissedOn: brusselsDayKey(d.dismissedAt) })),
    today,
  })
  return { today, suggestions }
}

/** Validate the dismiss body: { key } is a suggestion key, 1..200 chars. */
export function parseDismissBody(body: unknown): string {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw recurringError(400, 'Request body must be a JSON object', 'BODY_INVALID')
  }
  const key = (body as Record<string, unknown>).key
  if (typeof key !== 'string' || !key.trim() || key.length > SUGGESTION_KEY_MAX) {
    throw recurringError(400, `key must be a text of 1 to ${SUGGESTION_KEY_MAX} characters`, 'SUGGESTION_KEY_INVALID', 'key')
  }
  // Only keys the detector could have produced are stored, so junk cannot pile up.
  if (!parseSuggestionKey(key)) {
    throw recurringError(400, 'key is not a suggestion key', 'SUGGESTION_KEY_INVALID', 'key')
  }
  return key
}

/**
 * "Not now": hide this suggestion for 30 days. Idempotent: tapping again just
 * restarts the 30 days (dismissedAt = now), and a double tap racing past the
 * upsert's own existence check still ends as one row.
 */
export async function dismissSuggestion(userId: string, key: string, now: Date = new Date()): Promise<void> {
  try {
    await prisma.recurringSuggestionDismissal.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key, dismissedAt: now },
      update: { dismissedAt: now },
    })
  } catch (e: any) {
    if (e?.code !== 'P2002') throw e
    await prisma.recurringSuggestionDismissal.updateMany({ where: { userId, key }, data: { dismissedAt: now } })
  }
}
