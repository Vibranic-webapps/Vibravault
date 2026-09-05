import { prisma } from '~~/server/utils/prisma'
import { requireUserId } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id')!

  // SOFT delete. Financial data is the kind you regret hard-deleting, and the
  // partial unique index is scoped to live rows, so a deleted row does not
  // block the same transaction being re-imported later.
  const res = await prisma.transaction.updateMany({
    where: { id, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  })
  if (res.count === 0) throw createError({ statusCode: 404, statusMessage: 'Transaction not found' })

  return { ok: true }
})
