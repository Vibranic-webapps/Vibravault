import type { Goal, GoalContribution, Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { brusselsDayKey, goalProgress } from '~~/shared/goals'

// Savings goals: validation, serialisation and the row lock, in ONE module.
// Route files stay thin. Money is integer cents; saved is ALWAYS the SUM of the
// contributions (there is no stored total to drift).

export const GOAL_NAME_MAX = 80
export const GOAL_NOTE_MAX = 200
export const GOAL_TARGET_MAX_CENTS = 99_999_999
export const GOAL_AMOUNT_MAX_CENTS = 99_999_999

/**
 * Error with a stable machine-readable `code` (+ the offending `field`) next to
 * the English `statusMessage`. The existing screens show statusMessage as-is;
 * a screen that wants a translated message maps `data.code` to an i18n key.
 */
export function goalError(statusCode: number, statusMessage: string, code: string, field?: string) {
  return createError({ statusCode, statusMessage, data: { code, field } })
}

export const goalNotFound = () => goalError(404, 'Goal not found', 'GOAL_NOT_FOUND')

function asObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw goalError(400, 'Request body must be a JSON object', 'BODY_INVALID')
  }
  return body as Record<string, unknown>
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T/

/** 'YYYY-MM-DD' that is a REAL calendar day (rejects 2027-02-30), as UTC midnight. */
function parseDayString(s: string): Date | null {
  if (!DAY_RE.test(s)) return null
  const d = new Date(`${s}T00:00:00.000Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? d : null
}

/** A due date is a CALENDAR DAY, stored as UTC midnight. A date-only string is
 *  taken as-is; a full ISO timestamp is reduced to its Europe/Brussels day first. */
function parseDueDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (DAY_RE.test(v)) return parseDayString(v)
  if (DATETIME_RE.test(v)) {
    const instant = new Date(v)
    return Number.isNaN(instant.getTime()) ? null : parseDayString(brusselsDayKey(instant))
  }
  return null
}

/** A contribution date: a date-only string (-> UTC midnight, like Transaction.bookedAt) or a full ISO timestamp. */
function parseContributedAt(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (DAY_RE.test(v)) return parseDayString(v)
  if (DATETIME_RE.test(v)) {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

function validName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.trim() : ''
  if (!name) throw goalError(400, 'Name is required', 'GOAL_NAME_REQUIRED', 'name')
  if (name.length > GOAL_NAME_MAX) throw goalError(400, 'Name is too long', 'GOAL_NAME_TOO_LONG', 'name')
  return name
}

function validTarget(raw: unknown): number {
  // Strict: a real integer number. "45.50" or "4550" as a string is a client bug, not something to guess at.
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1) {
    throw goalError(400, 'Target must be a whole number of cents, at least 1', 'GOAL_TARGET_INVALID', 'targetCents')
  }
  if (raw > GOAL_TARGET_MAX_CENTS) throw goalError(400, 'Target is too large', 'GOAL_TARGET_TOO_LARGE', 'targetCents')
  return raw
}

function validDueDate(raw: unknown): Date {
  const d = parseDueDate(raw)
  if (!d) throw goalError(400, 'Enter a valid due date (YYYY-MM-DD)', 'GOAL_DUE_DATE_INVALID', 'dueDate')
  return d
}

export interface GoalCreateInput { name: string; targetCents: number; dueDate: Date | null }

export function validateGoalCreate(body: unknown): GoalCreateInput {
  const b = asObject(body)
  return {
    name: validName(b.name),
    targetCents: validTarget(b.targetCents),
    dueDate: b.dueDate === undefined || b.dueDate === null || b.dueDate === '' ? null : validDueDate(b.dueDate),
  }
}

/** PATCH: only the fields that are present change. `dueDate: null` clears the deadline. */
export function validateGoalPatch(body: unknown): Partial<GoalCreateInput> {
  const b = asObject(body)
  const data: Partial<GoalCreateInput> = {}
  if (b.name !== undefined) data.name = validName(b.name)
  if (b.targetCents !== undefined) data.targetCents = validTarget(b.targetCents)
  if (b.dueDate !== undefined) data.dueDate = b.dueDate === null || b.dueDate === '' ? null : validDueDate(b.dueDate)
  if (Object.keys(data).length === 0) {
    throw goalError(400, 'Nothing to update', 'GOAL_NOTHING_TO_UPDATE')
  }
  return data
}

export interface ContributionInput { amountCents: number; contributedAt: Date; note: string | null }

export function validateContributionInput(body: unknown): ContributionInput {
  const b = asObject(body)

  const amount = b.amountCents
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount === 0) {
    throw goalError(400, 'Amount must be a non-zero whole number of cents', 'CONTRIBUTION_AMOUNT_INVALID', 'amountCents')
  }
  if (Math.abs(amount) > GOAL_AMOUNT_MAX_CENTS) {
    throw goalError(400, 'Amount is too large', 'CONTRIBUTION_AMOUNT_TOO_LARGE', 'amountCents')
  }

  const contributedAt = parseContributedAt(b.contributedAt)
  if (!contributedAt) {
    throw goalError(400, 'Enter a valid date (YYYY-MM-DD)', 'CONTRIBUTION_DATE_INVALID', 'contributedAt')
  }

  let note: string | null = null
  if (b.note !== undefined && b.note !== null) {
    if (typeof b.note !== 'string') throw goalError(400, 'Note must be text', 'CONTRIBUTION_NOTE_INVALID', 'note')
    const trimmed = b.note.trim()
    if (trimmed.length > GOAL_NOTE_MAX) throw goalError(400, 'Note is too long', 'CONTRIBUTION_NOTE_TOO_LONG', 'note')
    note = trimmed || null
  }

  return { amountCents: amount, contributedAt, note }
}

// ---- Serialisation ----------------------------------------------------------

const dayOf = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

/** The goal as the API returns it: stored fields + progress, all from the one pure function. */
export function serializeGoal(goal: Goal, savedCents: number, now = new Date()) {
  return {
    id: goal.id,
    name: goal.name,
    targetCents: goal.targetCents,
    dueDate: dayOf(goal.dueDate), // 'YYYY-MM-DD' calendar day, or null
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
    ...goalProgress({ targetCents: goal.targetCents, savedCents, dueDate: goal.dueDate, now }),
  }
}

export function serializeContribution(c: GoalContribution) {
  return {
    id: c.id,
    goalId: c.goalId,
    amountCents: c.amountCents,
    contributedAt: c.contributedAt,
    note: c.note,
    createdAt: c.createdAt,
  }
}

// ---- Queries ----------------------------------------------------------------

type Db = Prisma.TransactionClient | typeof prisma

/** Saved total per goal (SUM of contributions). Goals with none are absent -> 0. */
export async function savedByGoal(userId: string, goalIds: string[], db: Db = prisma): Promise<Map<string, number>> {
  if (goalIds.length === 0) return new Map()
  const rows = await db.goalContribution.groupBy({
    by: ['goalId'],
    where: { userId, goalId: { in: goalIds } },
    _sum: { amountCents: true },
  })
  return new Map(rows.map((r) => [r.goalId, r._sum.amountCents ?? 0]))
}

/** The user's live goal, or a 404. Someone else's goal and a deleted goal look identical. */
export async function findOwnedGoal(userId: string, id: string, db: Db = prisma): Promise<Goal> {
  const goal = await db.goal.findFirst({ where: { id, userId, deletedAt: null } })
  if (!goal) throw goalNotFound()
  return goal
}

/**
 * Run `fn` inside a transaction that holds a row lock on the goal.
 *
 * "Read the saved total, then write" races: two simultaneous withdrawals could
 * both see enough money and both succeed. SELECT ... FOR UPDATE on the Goal row
 * makes the second one wait until the first has committed, then see its result.
 * Ownership + soft-delete are part of the locking query, so a foreign or deleted
 * goal yields the same 404 as a missing one.
 */
export async function withLockedGoal<T>(
  userId: string,
  goalId: string,
  fn: (tx: Prisma.TransactionClient, goal: Goal) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Goal"
      WHERE "id" = ${goalId} AND "userId" = ${userId} AND "deletedAt" IS NULL
      FOR UPDATE`
    if (locked.length === 0) throw goalNotFound()
    const goal = await tx.goal.findUniqueOrThrow({ where: { id: goalId } })
    return fn(tx, goal)
  })
}
