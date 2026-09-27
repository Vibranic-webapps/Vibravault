import { prisma } from '~~/server/utils/prisma'
import { requireUserId } from '~~/server/utils/auth'
import { loadRules } from '~~/server/utils/merchantRules'
import { pickRule } from '~~/shared/utils/rulePick'

const MAX_IDS = 5000

function ids(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > MAX_IDS || !value.every((v) => typeof v === 'string')) {
    throw createError({ statusCode: 400, statusMessage: 'keep and discard must be lists of ids' })
  }
  return [...new Set(value as string[])]
}

/**
 * The review's "Add these": `keep` become real transactions, `discard` are
 * remembered by fingerprint so no later import offers them again. Both leave
 * the waiting list. Anything waiting that is in NEITHER list (arrived while
 * the sheet was open) simply stays waiting.
 *
 * All in one database transaction: a row is never both added and discarded,
 * and never lost halfway.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = await readBody<{ keep?: unknown; discard?: unknown }>(event)
  const keep = ids(body?.keep ?? [])
  const discard = ids(body?.discard ?? []).filter((id) => !keep.includes(id))

  // Only rows that are really this user's and really waiting - an id from
  // someone else's list simply matches nothing.
  const rows = await prisma.pendingTransaction.findMany({
    where: { userId, id: { in: [...keep, ...discard] } },
  })
  const kept = rows.filter((r) => keep.includes(r.id))
  const dropped = rows.filter((r) => discard.includes(r.id))

  const categorising = (await loadRules(userId)).filter((r) => r.categoryId)

  await prisma.$transaction(async (tx) => {
    if (kept.length) {
      const batch = await tx.importBatch.create({
        data: {
          userId,
          filename: kept[0]!.filename ?? 'shared.csv',
          rowsParsed: rows.length,
          rowsInserted: kept.length,
          rowsSkipped: dropped.length,
        },
      })
      await tx.transaction.createMany({
        data: kept.map((r) => ({
          userId,
          accountId: r.accountId,
          importBatchId: batch.id,
          amountCents: r.amountCents,
          bookedAt: r.bookedAt,
          balanceAfterCents: r.balanceAfterCents,
          counterparty: r.counterparty,
          counterpartyIban: r.counterpartyIban,
          description: r.description,
          source: 'CSV',
          fingerprint: r.fingerprint,
          categoryId: r.categoryId ?? pickRule(categorising, r.description)?.categoryId ?? null,
        })),
        // Already live meanwhile (e.g. imported in the app)? Then it's skipped.
        skipDuplicates: true,
      })
    }
    if (dropped.length) {
      await tx.discardedFingerprint.createMany({
        data: dropped.map((r) => ({ userId, fingerprint: r.fingerprint })),
        skipDuplicates: true,
      })
    }
    await tx.pendingTransaction.deleteMany({ where: { userId, id: { in: rows.map((r) => r.id) } } })
  })

  return { added: kept.length, removed: dropped.length }
})
