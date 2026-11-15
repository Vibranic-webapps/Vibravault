import { isCategoryIcon } from '~~/shared/utils/categoryIcons'

/** Largest monthly budget accepted: 999,999.99 (same ceiling as goal amounts). */
export const CATEGORY_BUDGET_MAX_CENTS = 99_999_999

/**
 * Error with a stable machine-readable `code` (+ the offending `field`) next to
 * the English `statusMessage` - the same shape the goals API uses.
 */
export function categoryError(statusCode: number, statusMessage: string, code: string, field?: string) {
  return createError({ statusCode, statusMessage, data: { code, field } })
}

/**
 * The budget field of a category body.
 *  - key absent / undefined -> `undefined`: leave the stored budget alone
 *    (a rename that doesn't mention the budget must not wipe it)
 *  - null                   -> `null`: clear it
 *  - positive integer cents -> that number
 * Anything else (0, negative, float, string, too large) is rejected.
 */
function parseBudget(body: any): number | null | undefined {
  const raw = body?.budgetCents
  if (raw === undefined) return undefined
  if (raw === null) return null
  if (typeof raw !== 'number' || !Number.isSafeInteger(raw) || raw <= 0) {
    throw categoryError(400, 'Budget must be a positive whole number of cents', 'CATEGORY_BUDGET_INVALID', 'budgetCents')
  }
  if (raw > CATEGORY_BUDGET_MAX_CENTS) {
    throw categoryError(400, 'Budget is too large', 'CATEGORY_BUDGET_INVALID', 'budgetCents')
  }
  return raw
}

/** Shared validation for create + update, so the two can't drift apart. */
export function validateCategoryInput(body: any) {
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const kind = body?.kind
  const icon = typeof body?.icon === 'string' ? body.icon.trim() : ''
  const color = typeof body?.color === 'string' ? body.color.trim() : ''

  if (!name) throw createError({ statusCode: 400, statusMessage: 'Name is required' })
  if (name.length > 40) throw createError({ statusCode: 400, statusMessage: 'Name is too long' })
  if (kind !== 'INCOME' && kind !== 'EXPENSE' && kind !== 'TRANSFER') {
    throw createError({ statusCode: 400, statusMessage: 'Kind must be INCOME, EXPENSE or TRANSFER' })
  }
  // Only the 12 curated tints are allowed - the palette rule enforced server-side,
  // not just by which swatches the UI happens to render.
  if (!/^cat-(1[0-2]|[1-9])$/.test(color)) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown colour' })
  }
  // Only icons from the curated Lucide set (shared/utils/categoryIcons.ts).
  if (!isCategoryIcon(icon)) {
    throw createError({ statusCode: 400, statusMessage: 'Pick an icon' })
  }

  // Budgets only make sense for spending. A budget sent for any other kind is
  // an error; changing a category AWAY from expense silently clears its budget
  // (a stale limit on an income category must not survive).
  let budgetCents = parseBudget(body)
  if (kind !== 'EXPENSE') {
    if (typeof budgetCents === 'number') {
      throw categoryError(400, 'Only expense categories can have a budget', 'CATEGORY_BUDGET_NOT_EXPENSE', 'budgetCents')
    }
    budgetCents = null
  }

  return { name, kind, icon, color, budgetCents } as const
}
