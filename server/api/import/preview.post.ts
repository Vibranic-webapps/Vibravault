import { blockedFingerprints } from '~~/server/utils/importFilter'
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

  // Live rows and rows removed in a review block an import. A soft-DELETED
  // transaction does not: it may arrive again from a later, overlapping file.
  const known = await blockedFingerprints(userId, fingerprints, { pending: false })

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
