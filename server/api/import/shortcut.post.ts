import { prisma } from '~~/server/utils/prisma'
import { prismaLive } from '~~/server/utils/transactionQuery'
import { requireImportToken } from '~~/server/utils/importToken'
import { getDefaultAccountId } from '~~/server/utils/seed'
import { parseKbcCsv } from '~~/shared/utils/kbcCsv'
import { fingerprintRow } from '~~/server/utils/import'
import { loadRules } from '~~/server/utils/merchantRules'
import { pickRule } from '~~/shared/utils/rulePick'
import { reportEvent } from '~~/server/utils/vibradex'

/**
 * One-shot import for the iOS Shortcut: parse, dedupe and commit in a single
 * request, because a share-sheet action has no room for a preview step.
 *
 * Accepts the CSV either as multipart (Shortcuts' "Get Contents of URL" with a
 * file in the form) or as a raw body, since Shortcuts can be configured either
 * way and the difference is invisible to the user.
 *
 * There is no preview here, which is exactly why the SALDO BALANCE CHECK
 * matters: it is the only thing standing between a misparsed file and silent
 * bad data, so its result is reported back in the summary.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireImportToken(event)

  let data: Uint8Array | null = null
  let filename = 'shared.csv'

  const contentType = getHeader(event, 'content-type') ?? ''
  if (contentType.includes('multipart/form-data')) {
    const form = await readMultipartFormData(event)
    const f = form?.find((x) => x.data?.length)
    if (f?.data) { data = new Uint8Array(f.data); filename = f.filename ?? filename }
  } else {
    const raw = await readRawBody(event, false)
    if (raw) data = new Uint8Array(raw as Buffer)
  }

  if (!data?.length) throw createError({ statusCode: 400, statusMessage: 'No file received' })
  if (data.length > 5_000_000) throw createError({ statusCode: 400, statusMessage: 'File too large' })

  const parsed = parseKbcCsv(data)
  if (!parsed.rows.length) {
    throw createError({ statusCode: 400, statusMessage: 'No transactions found in that file' })
  }

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

  await prisma.$transaction(async (tx) => {
    const batch = await tx.importBatch.create({
      data: {
        userId,
        filename,
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
          importBatchId: batch.id,
          amountCents: r.amountCents,
          bookedAt: new Date(r.bookedAt),
          balanceAfterCents: r.balanceAfterCents,
          counterparty: r.counterparty,
          counterpartyIban: r.counterpartyIban,
          description: r.description,
          source: 'CSV',
          fingerprint,
          categoryId: pickRule(categorisingRules, r.description)?.categoryId ?? null,
        })),
        skipDuplicates: true,
      })
    }
  })

  const skipped = parsed.rows.length - toInsert.length
  const summary = [
    `${toInsert.length} added`,
    skipped ? `${skipped} already there` : null,
    parsed.errors.length ? `${parsed.errors.length} unreadable` : null,
    parsed.meta.balanceCheck.ok ? null : '⚠ balance mismatch',
  ].filter(Boolean).join(' · ')

  event.waitUntil?.(reportEvent(
    parsed.meta.balanceCheck.ok ? 'Shortcut import completed' : 'Shortcut import: balance mismatch',
    {
      type: parsed.meta.balanceCheck.ok ? 'info' : 'warning',
      severity: parsed.meta.balanceCheck.ok ? 'low' : 'medium',
      details: { userId, filename, inserted: toInsert.length, skipped, balanceOk: parsed.meta.balanceCheck.ok },
    },
  ))

  // `summary` is a single readable line so the Shortcut can show it as a
  // notification with one step.
  return {
    summary,
    inserted: toInsert.length,
    skipped,
    unreadable: parsed.errors.length,
    balanceOk: parsed.meta.balanceCheck.ok,
  }
})
