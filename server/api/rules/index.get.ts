import { requireUserId } from '~~/server/utils/auth'
import { loadRules } from '~~/server/utils/merchantRules'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  return loadRules(userId)
})
