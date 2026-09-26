import { prisma } from '~~/server/utils/prisma'
import { prismaLive } from '~~/server/utils/transactionQuery'
import { requireUserId } from '~~/server/utils/auth'
import { getDefaultAccountId } from '~~/server/utils/seed'
import { parseKbcCsv } from '~~/shared/utils/kbcCsv'
import { fingerprintRow } from '~~/server/utils/import'
import { loadRules } from '~~/server/utils/merchantRules'
import { pickRule } from '~~/shared/utils/rulePick'
import { reportEvent } from '~~/server/utils/vibradex'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)

  const form = await readMultipartFormData(event)
  const file = form?.find((f) => f.name === 'file')
  if (!file?.data) throw createError({ statusCode: 400, statusMessage: 'No file uploaded' })

  // Re-parsed server-side rather than trusting rows posted back from the
  // browser: the preview is a VIEW, never the source of what gets written.
  const parsed = parseKbcCsv(new Uint8Array(file.data))
  if (!parsed.rows.length) throw createError({ statusCode: 400, statusMessage: 'Nothing to import' })

  const fingerprints = parsed.rows.map(fingerprintRow)
  const existing = await prismaLive.transaction.findMany({
    where: { userId, fingerprint: { in: fingerprints } },
    select: { fingerprint: true },
  })
  const known = new Set(existing.map((e) => e.fingerprint))

  const accountId = await getDefaultAccountId(userId)

  // Taught rules that carry a category are applied as rows arrive, so a rule
  // taught once files every FUTURE import too. Only rules WITH a category are
  // considered here: a more specific rule that only renames must not stop a
  // broader rule from filing the row.
  const categorisingRules = (await loadRules(userId)).filter((r) => r.categoryId)
  const toInsert = parsed.rows
    .map((r, i) => ({ r, fingerprint: fingerprints[i]! }))
    .filter(({ fingerprint }) => !known.has(fingerprint))

  // One transaction: the batch and its rows land together or not at all, so a
  // failure halfway cannot leave a batch claiming rows that were never written.
  const batch = await prisma.$transaction(async (tx) => {
    const b = await tx.importBatch.create({
      data: {
        userId,
        filename: file.filename ?? 'upload.csv',
        rowsParsed: parsed.rows.length,
        rowsInserted: toInsert.length,
        rowsSkipped: parsed.rows.length - toInsert.length,
      },
    })

    if (toInsert.length) {
      await tx.transaction.createMany({
        data: toInsert.map(({ r, fingerprint }) => ({
          userId,
          accountId,
          importBatchId: b.id,
          amountCents: r.amountCents,          // already signed by the bank
          bookedAt: new Date(r.bookedAt),
          balanceAfterCents: r.balanceAfterCents,
          counterparty: r.counterparty,
          counterpartyIban: r.counterpartyIban,
          description: r.description,
          source: 'CSV',
          fingerprint,
          categoryId: pickRule(categorisingRules, r.description)?.categoryId ?? null,                    // uncategorised is a normal state
        })),
        skipDuplicates: true,
      })
    }
    return b
  })

  // A failed balance check is the one import signal worth a WARNING: it means
  // the parse disagrees with the bank's own running total.
  event.waitUntil?.(reportEvent(
    parsed.meta.balanceCheck.ok ? 'CSV import completed' : 'CSV import completed with a balance mismatch',
    {
      type: parsed.meta.balanceCheck.ok ? 'info' : 'warning',
      severity: parsed.meta.balanceCheck.ok ? 'low' : 'medium',
      details: {
        userId,
        parsed: parsed.rows.length,
        inserted: toInsert.length,
        skipped: parsed.rows.length - toInsert.length,
        unreadableRows: parsed.errors.length,
        balanceOk: parsed.meta.balanceCheck.ok,
        encoding: parsed.meta.encoding,
        delimiter: parsed.meta.delimiter,
      },
    },
  ))

  return {
    batchId: batch.id,
    parsed: parsed.rows.length,
    inserted: toInsert.length,
    skipped: parsed.rows.length - toInsert.length,
    balanceCheck: parsed.meta.balanceCheck,
  }
})
