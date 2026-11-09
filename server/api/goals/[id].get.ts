import { prisma } from '~~/server/utils/prisma'
import { requireUserId } from '~~/server/utils/auth'
import { findOwnedGoal, savedByGoal, serializeContribution, serializeGoal } from '~~/server/utils/goals'

/** One goal + its contributions, newest first. */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id')!

  const goal = await findOwnedGoal(userId, id)
  const contributions = await prisma.goalContribution.findMany({
    where: { goalId: id, userId },
    orderBy: [{ contributedAt: 'desc' }, { createdAt: 'desc' }],
  })
  const saved = (await savedByGoal(userId, [id])).get(id) ?? 0

  return { ...serializeGoal(goal, saved), contributions: contributions.map(serializeContribution) }
})
