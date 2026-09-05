import { prisma } from '~~/server/utils/prisma'
import { requireUserId } from '~~/server/utils/auth'
import { validateTransactionInput } from '~~/server/utils/transaction'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id')!
  const data = validateTransactionInput(await readBody(event))

  if (data.categoryId) {
    const owned = await prisma.category.findFirst({ where: { id: data.categoryId, userId } })
    if (!owned) throw createError({ statusCode: 400, statusMessage: 'Unknown category' })
  }

  // userId in the WHERE clause: a foreign id matches nothing rather than
  // editing someone else's row.
  const res = await prisma.transaction.updateMany({ where: { id, userId, deletedAt: null }, data })
  if (res.count === 0) throw createError({ statusCode: 404, statusMessage: 'Transaction not found' })

  return prisma.transaction.findUnique({ where: { id } })
})
