import { prisma } from '~~/server/utils/prisma'
import { requireUserId } from '~~/server/utils/auth'
import { parseDayKey } from '~~/shared/utils/insights'
import { findOwnedItem, recurringError, recurringNotFound, viewItem } from '~~/server/utils/recurring'

/** Undo a skip / mark paid: DELETE /api/recurring/[id]/settle?dueOn=YYYY-MM-DD. Idempotent (nothing to undo is fine). */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id')!
  const dueOn = parseDayKey(getQuery(event).dueOn)
  if (!dueOn) throw recurringError(400, 'dueOn must be a real date as YYYY-MM-DD', 'RECURRING_DUE_INVALID', 'dueOn')

  const item = await findOwnedItem(userId, id)
  if (!item) throw recurringNotFound()

  await prisma.recurringSettlement.deleteMany({ where: { recurringItemId: id, userId, dueOn } })
  return viewItem(userId, item)
})
