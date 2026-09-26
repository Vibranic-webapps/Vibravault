import { prisma } from '~~/server/utils/prisma'
import { requireUserId } from '~~/server/utils/auth'
import { validateTransactionPatch } from '~~/server/utils/transaction'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id')!
  // Only the fields actually sent are changed - see validateTransactionPatch.
  const data = validateTransactionPatch(await readBody(event))

  // Imported rows are the BANK'S record. They can be filed (category) and
  // renamed (taught rules), but their amount, date and bank text stay as the
  // bank recorded them - otherwise the data disagrees with the bank's own
  // running balance. Enforced here, not just by the drawer hiding the inputs:
  // a rule that only exists in the UI isn't a rule.
  const existing = await prisma.transaction.findFirst({
    where: { id, userId, deletedAt: null },
    select: { source: true },
  })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Transaction not found' })
  const bankFields = ['amountCents', 'bookedAt', 'description'] as const
  if (existing.source !== 'MANUAL' && bankFields.some((f) => f in data)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Imported transactions keep the amount, date and description your bank recorded',
    })
  }

  if (data.categoryId) {
    const owned = await prisma.category.findFirst({ where: { id: data.categoryId, userId } })
    if (!owned) throw createError({ statusCode: 400, statusMessage: 'Unknown category' })
  }

  // userId in the WHERE clause: a foreign id matches nothing rather than
  // editing someone else's row.
  const res = await prisma.transaction.updateMany({ where: { id, userId, deletedAt: null }, data })
  if (res.count === 0) throw createError({ statusCode: 404, statusMessage: 'Transaction not found' })

  return prisma.transaction.findUnique({ where: { id } })
})
