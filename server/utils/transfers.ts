import { prisma } from './prisma'

/**
 * The ids of a user's TRANSFER categories.
 *
 * In/Out totals are derived from the SIGN of amountCents, which is right for
 * income and spending but wrong for money moving between the user's own
 * accounts: a KBC -> Revolut top-up is negative, yet it is not spending.
 * Every total that means "income" or "spending" must exclude these rows.
 *
 * The BALANCE must NOT exclude them - the money really did leave this account.
 */
export async function transferCategoryIds(userId: string): Promise<Set<string>> {
  const rows = await prisma.category.findMany({
    where: { userId, kind: 'TRANSFER' },
    select: { id: true },
  })
  return new Set(rows.map((r) => r.id))
}

/** The single rule, used by every total so they can never disagree. */
export function countsAsFlow(categoryId: string | null, transfers: Set<string>): boolean {
  return !(categoryId && transfers.has(categoryId))
}
