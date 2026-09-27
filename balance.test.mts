/**
 * Tests for accountBalance. Run:  npx tsx balance.test.mts
 * "What is in this account right now?" - the bank's own Saldo from the newest
 * imported row, plus anything typed by hand after that import.
 */
import { accountBalance, type BalanceRow } from './shared/utils/balance'

const csv = (day: string, amount: number, after: number): BalanceRow =>
  ({ bookedAt: `2026-09-${day}`, amountCents: amount, balanceAfterCents: after, source: 'CSV' })
const manual = (day: string, amount: number): BalanceRow =>
  ({ bookedAt: `2026-09-${day}`, amountCents: amount, balanceAfterCents: null, source: 'MANUAL' })

interface Case { name: string; rows: BalanceRow[]; cents: number; fromBank: boolean; asOf: string | null; addedSince: number }

const cases: Case[] = [
  {
    name: 'no rows at all',
    rows: [], cents: 0, fromBank: false, asOf: null, addedSince: 0,
  },
  {
    name: 'only typed by hand: plain sum',
    rows: [manual('02', -1000), manual('05', 50000)],
    cents: 49000, fromBank: false, asOf: '2026-09-05', addedSince: 0,
  },
  {
    // Imported from the 1st, but the account already held €500 before that.
    // The sum would say -€42,18; the bank says €457,82. The bank wins.
    name: 'bank balance beats the sum (money that was there before the first import)',
    rows: [csv('01', -4218, 45782)],
    cents: 45782, fromBank: true, asOf: '2026-09-01', addedSince: 0,
  },
  {
    name: 'newest day wins, whatever order the rows come in',
    rows: [csv('10', 61240, 107022), csv('01', -4218, 45782)],
    cents: 107022, fromBank: true, asOf: '2026-09-10', addedSince: 0,
  },
  {
    // Three rows on one day, stored in no particular order. The chain decides:
    // 100.00 -> -10.00 -> 90.00 -> +50.00 -> 140.00 -> -5.00 -> 135.00
    name: 'several rows on the last day: the end of the balance chain wins',
    rows: [csv('12', 5000, 14000), csv('12', -500, 13500), csv('12', -1000, 9000)],
    cents: 13500, fromBank: true, asOf: '2026-09-12', addedSince: 0,
  },
  {
    name: 'typed by hand AFTER the last import is added on top',
    rows: [csv('12', -1000, 9000), manual('14', -2500), manual('15', -500)],
    cents: 6000, fromBank: true, asOf: '2026-09-12', addedSince: 2,
  },
  {
    // Typed on the same day as the import: probably the same payment the bank
    // already has. Counting it would count it twice.
    name: 'typed by hand on or before the import day is NOT added',
    rows: [manual('12', -1000), manual('03', -700), csv('12', -1000, 9000)],
    cents: 9000, fromBank: true, asOf: '2026-09-12', addedSince: 0,
  },
  {
    // A refund brings the balance back to where it was: 100 -> 90 -> 100.
    // The chain is a loop, so there's no clear end - must not crash, and must
    // land on one of the day's real balances.
    name: 'refund loops the chain: still returns a real balance',
    rows: [csv('20', -1000, 9000), csv('20', 1000, 10000)],
    cents: 10000, fromBank: true, asOf: '2026-09-20', addedSince: 0,
  },
]

let pass = 0
for (const c of cases) {
  const got = accountBalance(c.rows)
  const ok = got.cents === c.cents && got.fromBank === c.fromBank && got.asOf === c.asOf && got.addedSince === c.addedSince
  if (ok) pass++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${c.name}`)
  if (!ok) console.log(`        expected ${JSON.stringify({ cents: c.cents, fromBank: c.fromBank, asOf: c.asOf, addedSince: c.addedSince })}\n        got      ${JSON.stringify(got)}`)
}
console.log(`\n  ${pass}/${cases.length} passing`)
if (pass !== cases.length) process.exit(1)
