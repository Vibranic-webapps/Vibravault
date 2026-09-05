import { prisma } from '~~/server/utils/prisma'
import { requireUserId } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)

  return prisma.category.findMany({
    where: { userId },
    orderBy: [{ kind: 'asc' }, { name: 'asc' }],
  })
})
