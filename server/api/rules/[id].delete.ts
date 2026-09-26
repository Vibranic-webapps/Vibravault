import { prisma } from '~~/server/utils/prisma'
import { requireUserId } from '~~/server/utils/auth'

// Deleting a rule removes its NAME from every row immediately (labels are
// computed at render). Categories it already assigned are left in place:
// they are now ordinary data, and silently un-categorising rows would be a
// worse surprise than keeping them.
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id')!
  const res = await prisma.merchantRule.deleteMany({ where: { id, userId } })
  if (res.count === 0) throw createError({ statusCode: 404, statusMessage: 'Rule not found' })
  return { ok: true }
})
