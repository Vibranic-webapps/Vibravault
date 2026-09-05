import { prisma } from '~~/server/utils/prisma'
import { requireUserId } from '~~/server/utils/auth'
import { validateCategoryInput } from '~~/server/utils/category'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const data = validateCategoryInput(await readBody(event))

  const clash = await prisma.category.findFirst({ where: { userId, name: data.name } })
  if (clash) {
    throw createError({ statusCode: 409, statusMessage: 'You already have a category with that name' })
  }

  setResponseStatus(event, 201)
  return prisma.category.create({ data: { userId, ...data } })
})
