import { prismaLive } from '~~/server/utils/transactionQuery'
import { requireUserId } from '~~/server/utils/auth'
import { transferCategoryIds, countsAsFlow } from '~~/server/utils/transfers'

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
  const transfers = await transferCategoryIds(userId)
  const flow = items.filter((t) => countsAsFlow(t.categoryId, transfers))

  const income = flow.filter((t) => t.amountCents > 0).reduce((n, t) => n + t.amountCents, 0)
  const expense = flow.filter((t) => t.amountCents < 0).reduce((n, t) => n + t.amountCents, 0)
  // Reported separately so the UI can say how much merely moved, rather than
  // the number silently vanishing from the totals.
  const moved = items.filter((t) => !countsAsFlow(t.categoryId, transfers))
    .reduce((n, t) => n + Math.abs(t.amountCents), 0)

  return {
    items,
    totals: { income, expense, net: income + expense, count: items.length, transferred: moved },
  }
})
