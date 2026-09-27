import { prisma } from '~~/server/utils/prisma'
import { requireUserId } from '~~/server/utils/auth'
import { loadRules } from '~~/server/utils/merchantRules'
import { transactionLabel } from '~~/shared/utils/merchant'
import { pickRule } from '~~/shared/utils/rulePick'

/**
 * Transactions waiting for review (shared via the Shortcut), newest first,
 * with a readable name and a category suggestion. The suggestion is worked
 * out NOW, so a rule taught after the file arrived still applies.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const [rows, rules] = await Promise.all([
    prisma.pendingTransaction.findMany({
      where: { userId },
      orderBy: [{ bookedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true, amountCents: true, bookedAt: true, counterparty: true,
        description: true, balanceAfterCents: true, categoryId: true,
      },
    }),
    loadRules(userId),
  ])
  const categorising = rules.filter((r) => r.categoryId)

  return rows.map((r) => ({
    id: r.id,
    amountCents: r.amountCents,
    bookedAt: r.bookedAt.toISOString(),
    label: transactionLabel(r.counterparty, r.description, rules),
    description: r.description,
    categoryId: r.categoryId ?? pickRule(categorising, r.description)?.categoryId ?? null,
  }))
})
