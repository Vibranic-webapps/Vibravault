import { prisma } from '~~/server/utils/prisma'
import { requireUserId } from '~~/server/utils/auth'
import { recurringNotFound } from '~~/server/utils/recurring'

// Deleting an item removes its settlements too (cascade). Bank rows are never
// touched: they were never changed by it.
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id')!
  const res = await prisma.recurringItem.deleteMany({ where: { id, userId } })
  if (res.count === 0) throw recurringNotFound()
  return { ok: true }
})
