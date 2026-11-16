import { prisma } from '~~/server/utils/prisma'
import { requireUserId } from '~~/server/utils/auth'
import { reportEvent } from '~~/server/utils/vibradex'
import {
  assertOwnedRefs, parseRecurringBody, recurringError, viewItem, RECURRING_MAX_ITEMS,
} from '~~/server/utils/recurring'

/**
 * Create a recurring item. The frontend prefills the form from a transaction
 * ("Repeats every month" in the drawer) and sends plain fields; the server needs
 * no `fromTransactionId` (it would only re-verify ownership of a row whose data
 * it does not copy), so there is none.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const data = parseRecurringBody(await readBody(event))
  await assertOwnedRefs(userId, data)

  if (await prisma.recurringItem.count({ where: { userId } }) >= RECURRING_MAX_ITEMS) {
    throw recurringError(409, 'You have reached the maximum number of recurring items', 'RECURRING_LIMIT')
  }

  const item = await prisma.recurringItem.create({ data: { userId, ...data } })

  // Telemetry carries the user id only - never names or amounts.
  event.waitUntil?.(reportEvent('Recurring item created', { details: { userId } }))

  setResponseStatus(event, 201)
  return viewItem(userId, item)
})
