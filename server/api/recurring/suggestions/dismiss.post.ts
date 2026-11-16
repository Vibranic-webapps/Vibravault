import { requireUserId } from '~~/server/utils/auth'
import { dismissSuggestion, parseDismissBody } from '~~/server/utils/recurringSuggestions'

/** "Not now": { key } hides that suggestion for 30 days. Idempotent. Returns { ok: true }. */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const key = parseDismissBody(await readBody(event))
  await dismissSuggestion(userId, key)
  return { ok: true }
})
