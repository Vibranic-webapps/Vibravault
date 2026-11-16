import { prisma } from '~~/server/utils/prisma'
import { requireUserId } from '~~/server/utils/auth'
import { todayKey, viewItems } from '~~/server/utils/recurring'

/** Every recurring item (paused ones too) with its derived next due date + state and the last settled one. */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const today = todayKey()
  const items = await prisma.recurringItem.findMany({ where: { userId } })
  return { today, items: await viewItems(userId, items, today) }
})
