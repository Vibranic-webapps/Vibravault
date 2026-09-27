import type { H3Event } from 'h3'
import { prisma } from '~~/server/utils/prisma'
import { blockedFingerprints } from '~~/server/utils/importFilter'
import { requireImportToken } from '~~/server/utils/importToken'
import { getDefaultAccountId } from '~~/server/utils/seed'
import { parseKbcCsv } from '~~/shared/utils/kbcCsv'
import { fingerprintRow } from '~~/server/utils/import'
import { loadRules } from '~~/server/utils/merchantRules'
import { pickRule } from '~~/shared/utils/rulePick'
import { reportEvent } from '~~/server/utils/vibradex'

/**
 * Import from the iOS Shortcut: parse, dedupe and PARK the new rows for
 * review. A share-sheet action can't show a preview, so the review happens
 * the next time the app opens (ReviewSheet) - nothing counts before that.
 *
 * Accepts the CSV either as multipart (Shortcuts' "Get Contents of URL" with a
 * file in the form) or as a raw body, since Shortcuts can be configured either
 * way and the difference is invisible to the user.
 *
 * There is no preview here, which is exactly why the SALDO BALANCE CHECK
 * matters: it is the only thing standing between a misparsed file and silent
 * bad data, so its result is reported back in the summary.
 */
async function importFromShortcut(event: H3Event) {
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
  // Skip what's already live, already removed in a review, or already waiting.
  const blocked = await blockedFingerprints(userId, fingerprints, { pending: true })
  const accountId = await getDefaultAccountId(userId)

  // A taught rule suggests the category now; the review shows it, and it's
  // kept on "Add these". Only rules WITH a category are considered: a more
  // specific rule that only renames must not stop a broader one from filing.
  const categorisingRules = (await loadRules(userId)).filter((r) => r.categoryId)
  const toPark = parsed.rows
    .map((r, i) => ({ r, fingerprint: fingerprints[i]! }))
    .filter(({ fingerprint }) => !blocked.has(fingerprint))

  // PARKED, not imported: nothing counts until it's reviewed in the app
  // (decided 2026-09-27). PendingTransaction is a separate table, so no
  // total, list or balance can see these rows yet.
  if (toPark.length) {
    await prisma.pendingTransaction.createMany({
      data: toPark.map(({ r, fingerprint }) => ({
        userId,
        accountId,
        amountCents: r.amountCents,
        bookedAt: new Date(r.bookedAt),
        balanceAfterCents: r.balanceAfterCents,
        counterparty: r.counterparty,
        counterpartyIban: r.counterpartyIban,
        description: r.description,
        fingerprint,
        categoryId: pickRule(categorisingRules, r.description)?.categoryId ?? null,
        filename,
      })),
      skipDuplicates: true,
    })
  }

  const skipped = parsed.rows.length - toPark.length
  // The notification is read on the phone, so it follows the phone's
  // language (Shortcuts sends it as Accept-Language).
  const nl = (getHeader(event, 'accept-language') ?? '').toLowerCase().startsWith('nl')
  const summary = [
    toPark.length
      ? (nl ? `${toPark.length} wachten op je controle · open Vibravault` : `${toPark.length} waiting for your review · open Vibravault`)
      : (nl ? 'Niets nieuws' : 'Nothing new'),
    skipped ? (nl ? `${skipped} al bekend` : `${skipped} already known`) : null,
    parsed.errors.length ? (nl ? `${parsed.errors.length} onleesbaar` : `${parsed.errors.length} unreadable`) : null,
    parsed.meta.balanceCheck.ok ? null : (nl ? '⚠ saldo klopt niet' : '⚠ balance mismatch'),
  ].filter(Boolean).join(' · ')

  event.waitUntil?.(reportEvent(
    parsed.meta.balanceCheck.ok ? 'Shortcut import parked for review' : 'Shortcut import: balance mismatch',
    {
      type: parsed.meta.balanceCheck.ok ? 'info' : 'warning',
      severity: parsed.meta.balanceCheck.ok ? 'low' : 'medium',
      details: { userId, filename, waiting: toPark.length, skipped, balanceOk: parsed.meta.balanceCheck.ok },
    },
  ))

  return {
    summary,
    waiting: toPark.length,
    skipped,
    unreadable: parsed.errors.length,
    balanceOk: parsed.meta.balanceCheck.ok,
  }
}

/**
 * `?format=text`: answer with ONLY the summary line, as plain text. The
 * Shortcut can then show it straight away (Get Contents of URL -> Show
 * Notification) - no "Get Dictionary Value" step to find and fill in.
 * Errors come back as readable text too ("Invalid import token", "No
 * transactions found in that file"), so the notification says what went
 * wrong. Without the flag: the original JSON, so older Shortcuts keep working.
 */
export default defineEventHandler(async (event) => {
  const asText = getQuery(event).format === 'text'
  if (!asText) return importFromShortcut(event)

  setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')
  try {
    const result = await importFromShortcut(event)
    return result.summary
  } catch (e: unknown) {
    const err = e as { statusCode?: number; statusMessage?: string }
    setResponseStatus(event, err.statusCode ?? 500)
    return err.statusMessage ?? 'Import failed'
  }
})
