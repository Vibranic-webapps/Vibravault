import { requireUserId } from '~~/server/utils/auth'
import { goalError, serializeGoal, withLockedGoal } from '~~/server/utils/goals'

/** Remove one contribution (a typo, a double entry). Hard delete: the row is the record, nothing else points at it. */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id')!
  const cid = getRouterParam(event, 'cid')!

  const { goal, savedAfter } = await withLockedGoal(userId, id, async (tx, goal) => {
    const contribution = await tx.goalContribution.findFirst({ where: { id: cid, goalId: id, userId } })
    if (!contribution) throw goalError(404, 'Contribution not found', 'CONTRIBUTION_NOT_FOUND')

    const sum = await tx.goalContribution.aggregate({ where: { goalId: id }, _sum: { amountCents: true } })
    const savedBefore = sum._sum.amountCents ?? 0
    const savedAfter = savedBefore - contribution.amountCents

    // Removing a deposit can leave a later withdrawal with nothing behind it.
    if (savedAfter < 0) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Removing this would make the saved total negative',
        data: { code: 'GOAL_REMOVAL_MAKES_NEGATIVE', savedCents: savedBefore },
      })
    }

    await tx.goalContribution.delete({ where: { id: cid } })
    return { goal, savedAfter }
  })

  return { ok: true, goal: serializeGoal(goal, savedAfter) }
})
