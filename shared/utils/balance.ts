/**
 * "What is in this account right now?"
 *
 * The SUM of Vibravault's rows is only right if every transaction since the
 * account was opened is in here - it never is: money that was already there
 * before the first import is missing. The bank, though, tells us the answer
 * on every imported row: Saldo, the balance after that row. So:
 *
 *   balance = the bank's Saldo on the newest imported row
 *           + rows typed by hand on a LATER day (not imported yet)
 *
 * Hand-typed rows on or before that day are left out: the import most likely
 * already contains the same payment, and counting it twice is worse than
 * showing it a day late.
 *
 * No imported rows at all -> fall back to the plain sum.
 *
 * Pure function (no database), shared by server and tests.
 */
export interface BalanceRow {
  bookedAt: Date | string
  amountCents: number
  balanceAfterCents: number | null
  source: string
}

export interface AccountBalance {
  cents: number
  /** true = anchored on the bank's own balance; false = plain sum. */
  fromBank: boolean
  /** Day of the bank balance (fromBank) or of the newest row (sum). */
  asOf: string | null
  /** Hand-typed rows added on top of the bank balance. */
  addedSince: number
}

const day = (d: Date | string) => (typeof d === 'string' ? d : d.toISOString()).slice(0, 10)

/**
 * Rows of one day are stored in no particular order (an import saves them in
 * one go). The balance chain gives the order back: each row continues from
 * the previous row's balance (before = after - amount). The LAST row is the
 * one whose balance no other row continues from.
 */
function lastOfDay(rows: BalanceRow[]): BalanceRow {
  const befores = new Map<number, number>()
  for (const r of rows) {
    const before = r.balanceAfterCents! - r.amountCents
    befores.set(before, (befores.get(before) ?? 0) + 1)
  }
  const ends = rows.filter((r) => !befores.has(r.balanceAfterCents!))
  // Exactly one end: that's it. None (a refund looped the chain back) or
  // several (a gap in the data): no certain answer - take the last row
  // given, which is still a real balance the bank reported that day.
  return ends.length === 1 ? ends[0]! : rows[rows.length - 1]!
}

export function accountBalance(rows: BalanceRow[]): AccountBalance {
  const banked = rows.filter((r) => r.balanceAfterCents !== null)

  if (!banked.length) {
    const newest = rows.reduce<string | null>((m, r) => (m === null || day(r.bookedAt) > m ? day(r.bookedAt) : m), null)
    return { cents: rows.reduce((n, r) => n + r.amountCents, 0), fromBank: false, asOf: newest, addedSince: 0 }
  }

  const lastDay = banked.reduce((m, r) => (day(r.bookedAt) > m ? day(r.bookedAt) : m), '')
  const anchor = lastOfDay(banked.filter((r) => day(r.bookedAt) === lastDay))

  const since = rows.filter((r) => r.balanceAfterCents === null && r.source === 'MANUAL' && day(r.bookedAt) > lastDay)

  return {
    cents: anchor.balanceAfterCents! + since.reduce((n, r) => n + r.amountCents, 0),
    fromBank: true,
    asOf: lastDay,
    addedSince: since.length,
  }
}
