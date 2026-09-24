import { requireUserId } from '~~/server/utils/auth'
import { createImportToken } from '~~/server/utils/importToken'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = await readBody<{ name?: unknown }>(event)

  const name = typeof body?.name === 'string' && body.name.trim()
    ? body.name.trim().slice(0, 40)
    : 'Shortcut'

  setResponseStatus(event, 201)
  // `raw` is returned exactly once. It is never stored and never retrievable.
  return createImportToken(userId, name)
})
