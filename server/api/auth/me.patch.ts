import { prisma } from '~~/server/utils/prisma'
import { requireUserId } from '~~/server/utils/auth'

const MAX_NAME = 40

// Update your own profile. Only `name` for now. An empty name clears it
// (the app then just says "Hey there").
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = await readBody<{ name?: unknown }>(event)

  if (!body || !('name' in body)) {
    throw createError({ statusCode: 400, statusMessage: 'Nothing to update' })
  }
  if (body.name !== null && typeof body.name !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Name must be text' })
  }

  const name = (body.name ?? '').replace(/\s+/g, ' ').trim()
  if (name.length > MAX_NAME) {
    throw createError({ statusCode: 400, statusMessage: `Name can be at most ${MAX_NAME} characters` })
  }

  return prisma.user.update({
    where: { id: userId },
    data: { name: name || null },
    select: { id: true, email: true, name: true },
  })
})
