import { createHash } from 'node:crypto'
import type { ParsedRow } from '~~/shared/utils/kbcCsv'

/**
 * Dedupe fingerprint.
 *
 * Base key = date + amount + BALANCE-AFTER + description.
 *   - `Saldo` does the heavy lifting: two identical same-day transactions leave
 *     different running balances, so they fingerprint differently. It is also
 *     intrinsic to the transaction rather than to the file, unlike a position.
 *   - `description` replaces counterparty, which was blank in 100% of rows of
 *     the real export.
 *   - `ordinal` is the fallback for the rare case where a refund returns the
 *     balance to a previous value.
 *
 * Stable across re-imports: every input is a property of the row itself.
 */
export function fingerprintRow(r: ParsedRow): string {
  const base = [r.bookedAt, r.amountCents, r.balanceAfterCents ?? '', r.description, r.ordinal].join('|')
  return createHash('sha256').update(base).digest('hex')
}
