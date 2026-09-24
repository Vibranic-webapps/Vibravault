import { prisma } from '~~/server/utils/prisma'
import { requireUserId } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  // Never selects hashedToken: there is no route by which a token becomes
  // readable again after it is created.
  return prisma.importToken.findMany({
    where: { userId },
    select: { id: true, name: true, lastUsedAt: true, revokedAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
})
