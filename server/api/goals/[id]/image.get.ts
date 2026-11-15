import { requireUserId } from '~~/server/utils/auth'
import { findOwnedGoalImage } from '~~/server/utils/goals'

/**
 * The goal's uploaded picture as raw bytes. Only the owner of a live goal can
 * read it (someone else's goal, a deleted goal and a goal without an upload all
 * answer 404). The `?v=<updatedAt>` in the URL changes whenever the goal is
 * edited, so the long-lived cache below never serves a stale picture.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id')!

  const { data, mime } = await findOwnedGoalImage(userId, id)

  setResponseHeaders(event, {
    'Content-Type': mime,
    'Content-Length': String(data.length),
    'Cache-Control': 'private, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  })
  return data
})
