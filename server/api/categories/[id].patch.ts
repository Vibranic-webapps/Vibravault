import { prisma } from '~~/server/utils/prisma'
import { requireUserId } from '~~/server/utils/auth'
import { validateCategoryInput } from '~~/server/utils/category'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id')!
  const data = validateCategoryInput(await readBody(event))

  // Same rule as creating: names are unique per user. Without this check a
  // rename onto an existing name hit the database constraint -> a 500.
  const clash = await prisma.category.findFirst({ where: { userId, name: data.name, NOT: { id } } })
  if (clash) {
    throw createError({ statusCode: 409, statusMessage: 'You already have a category with that name' })
  }

  // updateMany, not update: it lets userId sit in the WHERE clause, so another
  // user's category id simply matches nothing. `update({ where: { id } })`
  // would happily edit a row belonging to someone else.
  const result = await prisma.category.updateMany({ where: { id, userId }, data })
  if (result.count === 0) throw createError({ statusCode: 404, statusMessage: 'Category not found' })

  return prisma.category.findUnique({ where: { id } })
})
