import { prisma } from '~~/server/utils/prisma'
import { requireUserId } from '~~/server/utils/auth'
import {
  assertOwnedRefs, fieldsOf, findOwnedItem, parseRecurringBody, recurringNotFound, viewItem,
} from '~~/server/utils/recurring'

/** Edit any field, or pause/resume with { active }. Only the keys sent change; the merged result is validated like a create. */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id')!
  const current = await findOwnedItem(userId, id)
  if (!current) throw recurringNotFound()

  const data = parseRecurringBody(await readBody(event), fieldsOf(current))
  await assertOwnedRefs(userId, data)

  // updateMany so userId sits in the WHERE: a foreign id matches nothing.
  const res = await prisma.recurringItem.updateMany({ where: { id, userId }, data })
  if (res.count === 0) throw recurringNotFound()

  const item = await findOwnedItem(userId, id)
  if (!item) throw recurringNotFound()
  return viewItem(userId, item)
})
