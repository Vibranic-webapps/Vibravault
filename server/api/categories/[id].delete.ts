import { prisma } from '~~/server/utils/prisma'
import { requireUserId } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id')!

  // Transactions are NOT deleted with the category: the relation is SetNull,
  // so they survive as uncategorised. Deleting a category must never destroy
  // financial history.
  const result = await prisma.category.deleteMany({ where: { id, userId } })
  if (result.count === 0) throw createError({ statusCode: 404, statusMessage: 'Category not found' })

  return { ok: true }
})
