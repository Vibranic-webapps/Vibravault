import { prisma } from '~~/server/utils/prisma'
import { requireUserId } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)

  const rows = await prisma.category.findMany({
    where: { userId },
    orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    // How many LIVE transactions each holds - the Categories screen shows it,
    // and "delete" can say what it affects. Soft-deleted rows don't count.
    include: { _count: { select: { transactions: { where: { deletedAt: null } } } } },
  })
  return rows.map(({ _count, ...c }) => ({ ...c, count: _count.transactions }))
})
