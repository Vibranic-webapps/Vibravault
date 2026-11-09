import { prisma } from '~~/server/utils/prisma'
import { requireUserId } from '~~/server/utils/auth'
import { serializeGoal, validateGoalCreate } from '~~/server/utils/goals'
import { reportEvent } from '~~/server/utils/vibradex'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const data = validateGoalCreate(await readBody(event))

  const goal = await prisma.goal.create({ data: { userId, ...data } })

  // Telemetry carries the user id only - never the goal name or amounts.
  event.waitUntil?.(reportEvent('Savings goal created', { details: { userId } }))

  setResponseStatus(event, 201)
  return serializeGoal(goal, 0)
})
