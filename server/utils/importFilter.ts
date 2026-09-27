import { prisma } from './prisma'
import { prismaLive } from './transactionQuery'

/**
 * Which of these fingerprints must an import SKIP? One answer for every
 * import path, so they can't drift apart:
 *
 *  - already a live transaction                -> "already there"
 *  - removed in a review (DiscardedFingerprint) -> you said no once; never
 *    offered again (decided 2026-09-27)
 *  - already waiting for review (optional)      -> the Shortcut must not park
 *    the same row twice; the in-app import, which commits directly, passes
 *    pending: false and takes those rows live instead.
 *
 * Soft-DELETED transactions deliberately do NOT block: a row deleted after
 * import may come back from a later file (decided at the start of v1).
 */
export async function blockedFingerprints(
  userId: string,
  fingerprints: string[],
  opts: { pending: boolean },
): Promise<Set<string>> {
  if (!fingerprints.length) return new Set()
  const where = { userId, fingerprint: { in: fingerprints } }
  const [live, discarded, pending] = await Promise.all([
    prismaLive.transaction.findMany({ where, select: { fingerprint: true } }),
    prisma.discardedFingerprint.findMany({ where, select: { fingerprint: true } }),
    opts.pending ? prisma.pendingTransaction.findMany({ where, select: { fingerprint: true } }) : [],
  ])
  return new Set([...live, ...discarded, ...pending].map((r) => r.fingerprint))
}
