import { prisma } from '~~/server/utils/prisma'
import { requireUserId } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id')!

  // Revoked, not deleted - the record of what existed is worth keeping.
  // userId in the WHERE clause so a foreign id matches nothing.
  const res = await prisma.importToken.updateMany({
    where: { id, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  if (res.count === 0) throw createError({ statusCode: 404, statusMessage: 'Token not found' })

  return { ok: true }
})
