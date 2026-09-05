import { prisma } from '~~/server/utils/prisma'
import { requireUserId } from '~~/server/utils/auth'
import { getDefaultAccountId } from '~~/server/utils/seed'
import { validateTransactionInput, manualFingerprint } from '~~/server/utils/transaction'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const data = validateTransactionInput(await readBody(event))

  // Category must belong to this user - never trust an id from the client.
  if (data.categoryId) {
    const owned = await prisma.category.findFirst({ where: { id: data.categoryId, userId } })
    if (!owned) throw createError({ statusCode: 400, statusMessage: 'Unknown category' })
  }

  const accountId = await getDefaultAccountId(userId)

  setResponseStatus(event, 201)
  return prisma.transaction.create({
    data: {
      userId,
      accountId,
      ...data,
      source: 'MANUAL',
      fingerprint: manualFingerprint(),
    },
  })
})
