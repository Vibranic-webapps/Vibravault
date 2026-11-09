import { prisma } from '~~/server/utils/prisma'
import { requireUserId } from '~~/server/utils/auth'
import { goalNotFound } from '~~/server/utils/goals'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id')!

  // SOFT delete, like transactions: the contributions stay in the table, so a
  // mistaken delete is recoverable by clearing deletedAt.
  const res = await prisma.goal.updateMany({
    where: { id, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  })
  if (res.count === 0) throw goalNotFound()

  return { ok: true }
})
