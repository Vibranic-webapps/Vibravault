import { prisma } from '~~/server/utils/prisma'
import { requireUserId } from '~~/server/utils/auth'
import { findOwnedGoal, goalNotFound, savedByGoal, serializeGoal, validateGoalPatch } from '~~/server/utils/goals'

/** Rename, change the target, set/clear the due date, tint or picture. Lowering the target below
 *  what is saved is allowed: the goal simply counts as reached. */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id')!
  const data = validateGoalPatch(await readBody(event))

  // updateMany so userId + deletedAt sit in the WHERE: a foreign or deleted goal matches nothing.
  const res = await prisma.goal.updateMany({ where: { id, userId, deletedAt: null }, data })
  if (res.count === 0) throw goalNotFound()

  const goal = await findOwnedGoal(userId, id)
  const saved = (await savedByGoal(userId, [id])).get(id) ?? 0
  return serializeGoal(goal, saved)
})
