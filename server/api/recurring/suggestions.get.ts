import { requireUserId } from '~~/server/utils/auth'
import { loadSuggestions } from '~~/server/utils/recurringSuggestions'

/**
 * "Looks recurring" suggestions found in the bank history (max 5, never throws
 * for empty data). Nothing is created: the frontend adds one through the normal
 * POST /api/recurring. Response: { today, suggestions: Suggestion[] }.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  return loadSuggestions(userId)
})
