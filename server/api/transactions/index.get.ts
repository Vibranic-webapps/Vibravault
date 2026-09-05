import { prismaLive } from '~~/server/utils/transactionQuery'
import { requireUserId } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const q = getQuery(event)

  // Month window: ?month=2026-09 -> [1 Sep, 1 Oct)
  const where: Record<string, unknown> = { userId }
  if (typeof q.month === 'string' && /^\d{4}-\d{2}$/.test(q.month)) {
    const [y, m] = q.month.split('-').map(Number)
    where.bookedAt = { gte: new Date(Date.UTC(y!, m! - 1, 1)), lt: new Date(Date.UTC(y!, m!, 1)) }
  }
  if (typeof q.categoryId === 'string' && q.categoryId) where.categoryId = q.categoryId
  if (q.uncategorised === '1') where.categoryId = null

  const items = await prismaLive.transaction.findMany({
    where,
    orderBy: [{ bookedAt: 'desc' }, { createdAt: 'desc' }],
    take: 500,
  })

  // Totals for the same window. Income and expense are derived from the SIGN,
  // not from the category - uncategorised rows still count, which is the whole
  // point of the signed convention.
  const income = items.filter((t) => t.amountCents > 0).reduce((n, t) => n + t.amountCents, 0)
  const expense = items.filter((t) => t.amountCents < 0).reduce((n, t) => n + t.amountCents, 0)

  return { items, totals: { income, expense, net: income + expense, count: items.length } }
})
