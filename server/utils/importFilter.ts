import { prisma } from './prisma'
import { prismaLive } from './transactionQuery'
import { getDefaultAccountId } from './seed'
import { fingerprintRow } from './import'
import { loadRules } from './merchantRules'
import { pickRule } from '~~/shared/utils/rulePick'
import type { ParseResult } from '~~/shared/utils/kbcCsv'

/**
 * Which of these fingerprints must an import SKIP? One answer for every
 * import path, so they can't drift apart:
 *
 *  - already a live transaction                 -> "already there"
 *  - removed in a review (DiscardedFingerprint) -> you said no once; never
 *    offered again (decided 2026-09-27)
 *  - already waiting for review                 -> don't park it twice
 *
 * Soft-DELETED transactions deliberately do NOT block: a row deleted after
 * import may come back from a later file (decided at the start of v1).
 */
export async function blockedFingerprints(userId: string, fingerprints: string[]): Promise<Set<string>> {
  if (!fingerprints.length) return new Set()
  const where = { userId, fingerprint: { in: fingerprints } }
  const [live, discarded, pending] = await Promise.all([
    prismaLive.transaction.findMany({ where, select: { fingerprint: true } }),
    prisma.discardedFingerprint.findMany({ where, select: { fingerprint: true } }),
    prisma.pendingTransaction.findMany({ where, select: { fingerprint: true } }),
  ])
  return new Set([...live, ...discarded, ...pending].map((r) => r.fingerprint))
}

/**
 * Every import - the Shortcut and the Import screen - goes through here:
 * new rows are PARKED for review (PendingTransaction), never written
 * straight into Transaction. Nothing counts until "Add these" in the review
 * sheet. Returns how many now wait and how many were skipped.
 */
export async function parkForReview(userId: string, parsed: ParseResult, filename: string) {
  const fingerprints = parsed.rows.map(fingerprintRow)
  const blocked = await blockedFingerprints(userId, fingerprints)
  const accountId = await getDefaultAccountId(userId)

  // A taught rule suggests the category now; the review shows it. Only
  // rules WITH a category: a more specific rule that only renames must not
  // stop a broader one from filing the row.
  const categorising = (await loadRules(userId)).filter((r) => r.categoryId)
  const toPark = parsed.rows
    .map((r, i) => ({ r, fingerprint: fingerprints[i]! }))
    .filter(({ fingerprint }) => !blocked.has(fingerprint))

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
        categoryId: pickRule(categorising, r.description)?.categoryId ?? null,
        filename,
      })),
      skipDuplicates: true,
    })
  }

  return { waiting: toPark.length, skipped: parsed.rows.length - toPark.length }
}
