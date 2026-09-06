import { prismaLive } from '~~/server/utils/transactionQuery'
import { requireUserId } from '~~/server/utils/auth'
import { parseKbcCsv } from '~~/shared/utils/kbcCsv'
import { fingerprintRow } from '~~/server/utils/import'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)

  const form = await readMultipartFormData(event)
  const file = form?.find((f) => f.name === 'file')
  if (!file?.data) throw createError({ statusCode: 400, statusMessage: 'No file uploaded' })
  if (file.data.length > 5_000_000) {
    throw createError({ statusCode: 400, statusMessage: 'File is too large (max 5 MB)' })
  }

  const parsed = parseKbcCsv(new Uint8Array(file.data))
  if (!parsed.rows.length) {
    return { ...parsed, filename: file.filename ?? 'upload.csv', rows: [], newCount: 0, duplicateCount: 0 }
  }

  const fingerprints = parsed.rows.map(fingerprintRow)

  // Only LIVE rows block an import: a soft-deleted transaction must not stop
  // the same row arriving again from a later, overlapping export.
  const existing = await prismaLive.transaction.findMany({
    where: { userId, fingerprint: { in: fingerprints } },
    select: { fingerprint: true },
  })
  const known = new Set(existing.map((e) => e.fingerprint))

  const rows = parsed.rows.map((r, i) => ({
    ...r,
    fingerprint: fingerprints[i]!,
    duplicate: known.has(fingerprints[i]!),
  }))

  return {
    filename: file.filename ?? 'upload.csv',
    meta: parsed.meta,
    errors: parsed.errors,
    rows,
    newCount: rows.filter((r) => !r.duplicate).length,
    duplicateCount: rows.filter((r) => r.duplicate).length,
  }
})
