import { requireUserId } from '~~/server/utils/auth'
import { parkForReview } from '~~/server/utils/importFilter'
import { parseKbcCsv } from '~~/shared/utils/kbcCsv'
import { reportEvent } from '~~/server/utils/vibradex'

/**
 * The Import screen: upload a bank CSV -> new rows are PARKED for review,
 * exactly like the Shortcut. The screen then opens the review sheet, so
 * there's one way of choosing what goes in, and "removed = remembered"
 * holds for every import.
 *
 * Answers with what the file held, so the screen can say it before the
 * review: how many new, how many already known, unreadable lines, and the
 * bank's running-balance check (the one signal that a row went missing).
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)

  const form = await readMultipartFormData(event)
  const file = form?.find((f) => f.name === 'file')
  if (!file?.data?.length) throw createError({ statusCode: 400, statusMessage: 'No file uploaded' })
  if (file.data.length > 5_000_000) throw createError({ statusCode: 413, statusMessage: 'File is too large (max 5 MB)' })

  const filename = file.filename ?? 'upload.csv'
  const parsed = parseKbcCsv(new Uint8Array(file.data))
  if (!parsed.rows.length) {
    throw createError({ statusCode: 422, statusMessage: parsed.errors[0]?.reason ?? 'No transactions found in that file' })
  }

  const { waiting, skipped } = await parkForReview(userId, parsed, filename)

  event.waitUntil?.(reportEvent(
    parsed.meta.balanceCheck.ok ? 'CSV upload parked for review' : 'CSV upload: balance mismatch',
    {
      type: parsed.meta.balanceCheck.ok ? 'info' : 'warning',
      severity: parsed.meta.balanceCheck.ok ? 'low' : 'medium',
      details: { userId, filename, waiting, skipped, unreadable: parsed.errors.length, balanceOk: parsed.meta.balanceCheck.ok },
    },
  ))

  return {
    filename,
    rows: parsed.rows.length,
    waiting,
    skipped,
    errors: parsed.errors,
    balanceCheck: parsed.meta.balanceCheck,
  }
})
