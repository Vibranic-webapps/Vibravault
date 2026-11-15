import { prisma } from '~~/server/utils/prisma'
import { requireUserId } from '~~/server/utils/auth'
import { goalOmitImage, savedByGoal, serializeGoal } from '~~/server/utils/goals'

/** The user's live goals, each with its progress. Two queries total (goals + one grouped SUM), no N+1. */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)

  const goals = await prisma.goal.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    omit: goalOmitImage, // never drag the picture bytes into the list
  })
  const saved = await savedByGoal(userId, goals.map((g) => g.id))
  const now = new Date()

  return goals.map((g) => serializeGoal(g, saved.get(g.id) ?? 0, now))
})
