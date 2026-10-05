import { prisma } from '~~/server/utils/prisma'
import { requireUserId } from '~~/server/utils/auth'
import { createImportToken } from '~~/server/utils/importToken'
import { refuseIfDemo } from '~~/server/utils/demo'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)

  // No keys for the shared demo account: a key outlives the visit (it keeps
  // working after logout), so a visitor would keep lasting access.
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
  if (!me) throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  refuseIfDemo(me.email)

  const body = await readBody<{ name?: unknown }>(event)

  const name = typeof body?.name === 'string' && body.name.trim()
    ? body.name.trim().slice(0, 40)
    : 'Shortcut'

  setResponseStatus(event, 201)
  // `raw` is returned exactly once. It is never stored and never retrievable.
  return createImportToken(userId, name)
})
