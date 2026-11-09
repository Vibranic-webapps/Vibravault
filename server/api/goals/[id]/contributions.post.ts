import { requireUserId } from '~~/server/utils/auth'
import { serializeContribution, serializeGoal, validateContributionInput, withLockedGoal } from '~~/server/utils/goals'
import { reportEvent } from '~~/server/utils/vibradex'

/** Add money to a goal (positive) or take money out (negative). */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id')!
  const data = validateContributionInput(await readBody(event))

  const { goal, contribution, savedBefore, savedAfter } = await withLockedGoal(userId, id, async (tx, goal) => {
    const sum = await tx.goalContribution.aggregate({ where: { goalId: id }, _sum: { amountCents: true } })
    const savedBefore = sum._sum.amountCents ?? 0
    const savedAfter = savedBefore + data.amountCents

    // Checked under the row lock, so two simultaneous withdrawals cannot both pass.
    if (savedAfter < 0) {
      throw createError({
        statusCode: 409,
        statusMessage: 'You cannot take out more than is saved in this goal',
        data: { code: 'GOAL_WITHDRAWAL_EXCEEDS_SAVED', field: 'amountCents', savedCents: savedBefore },
      })
    }

    const contribution = await tx.goalContribution.create({ data: { userId, goalId: id, ...data } })
    return { goal, contribution, savedBefore, savedAfter }
  })

  // Fire once, on the contribution that crosses the line (not on later top-ups).
  if (savedBefore < goal.targetCents && savedAfter >= goal.targetCents) {
    event.waitUntil?.(reportEvent('Savings goal reached', { details: { userId } }))
  }

  setResponseStatus(event, 201)
  return { contribution: serializeContribution(contribution), goal: serializeGoal(goal, savedAfter) }
})
