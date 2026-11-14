/**
 * Savings-goal progress math. ONE pure function, dependency-free, so the server
 * (GET /api/goals) and the frontend (live preview while typing) cannot drift.
 *
 * Rules:
 *  - Money is INTEGER CENTS. Nothing here ever produces a float amount.
 *  - saved is always the SUM of the contributions (there is no stored total).
 *  - "Today" is the calendar day in Europe/Brussels, not the server's UTC day.
 *    At 00:30 Brussels time the UTC clock still says yesterday.
 *  - A dueDate is a CALENDAR DAY. The API stores it as UTC midnight of that day,
 *    so a Date is read by its UTC y-m-d; a 'YYYY-MM-DD' string is used as-is.
 */

export const GOAL_TIMEZONE = 'Europe/Brussels'

export interface GoalProgressInput {
  targetCents: number
  /** Sum of all contributions (see sumCents). Can be negative only if data is corrupt; treated as 0 for display. */
  savedCents: number
  /** Calendar day: 'YYYY-MM-DD', or a Date stored as UTC midnight. null = no deadline. */
  dueDate?: Date | string | null
  /** Injectable clock for tests. Defaults to the real current time. */
  now?: Date
}

export interface GoalProgress {
  savedCents: number
  /** Never negative: 0 once the goal is reached or exceeded. */
  remainingCents: number
  /** Whole percent 0-100, rounded DOWN so 99.9% never shows as done. */
  percent: number
  isReached: boolean
  /** Whole weeks until the due date, minimum 1 while the date is today or in the future.
   *  null = no due date. 0 = overdue. */
  weeksLeft: number | null
  /** Cents per week still to save, rounded UP. null = no due date, reached, or overdue. */
  neededPerWeekCents: number | null
  /** Past the due date and not reached. */
  isOverdue: boolean
}

/** Sum of signed contribution amounts, in cents. */
export function sumCents(amounts: readonly number[]): number {
  let total = 0
  for (const a of amounts) total += a
  return total
}

/** 'YYYY-MM-DD' of an instant, as seen on the clock in Europe/Brussels. */
export function brusselsDayKey(instant: Date): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: GOAL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)
}

/** Day key of a stored due date: a 'YYYY-MM-DD' string as-is, a Date by its UTC y-m-d. */
function dueDayKey(due: Date | string): string | null {
  if (typeof due === 'string') return /^\d{4}-\d{2}-\d{2}/.test(due) ? due.slice(0, 10) : null
  return Number.isNaN(due.getTime()) ? null : due.toISOString().slice(0, 10)
}

const MS_PER_DAY = 86_400_000

/** Whole days from one day key to another (positive = `to` is later). Day keys
 *  are compared as UTC midnights, so DST never skews the count. */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY)
}

export function goalProgress(input: GoalProgressInput): GoalProgress {
  const target = input.targetCents
  const saved = input.savedCents
  const shown = Math.max(0, saved)

  const isReached = target > 0 && saved >= target
  const remainingCents = Math.max(0, target - saved)
  const percent = target > 0
    ? Math.min(100, Math.max(0, Math.floor((shown * 100) / target)))
    : 0

  const dueKey = input.dueDate ? dueDayKey(input.dueDate) : null
  if (!dueKey) {
    return { savedCents: saved, remainingCents, percent, isReached, weeksLeft: null, neededPerWeekCents: null, isOverdue: false }
  }

  const days = daysBetween(brusselsDayKey(input.now ?? new Date()), dueKey)

  if (days < 0) {
    // Past the deadline. A goal that WAS reached in time is simply done, not overdue.
    return { savedCents: saved, remainingCents, percent, isReached, weeksLeft: 0, neededPerWeekCents: null, isOverdue: !isReached }
  }

  // Due today (days = 0) still counts as one week: "all of it this week".
  const weeksLeft = Math.max(1, Math.ceil(days / 7))
  const neededPerWeekCents = isReached ? null : Math.ceil(remainingCents / weeksLeft)

  return { savedCents: saved, remainingCents, percent, isReached, weeksLeft, neededPerWeekCents, isOverdue: false }
}
