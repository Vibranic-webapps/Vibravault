/**
 * Tests for recurring payments + bills (fake data only). Run:  npx tsx recurring.test.mts
 * Covers dueDates (month-end clamp, leap years, steps), matchPayment /
 * assignPayments (window, amount, direction, transfers, deleted rows, one row
 * pays one occurrence), billState and occurrences (overrides, pause).
 */
import {
  dueDates, assignPayments, matchPayment, billState, occurrences, matchFetchRange, isSettled,
  type MatchRule, type PayTx,
} from './shared/utils/recurring'

let pass = 0
let total = 0
function check(name: string, got: unknown, want: unknown) {
  total++
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (ok) pass++
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${ok ? '' : `  (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`}`)
}

const item = (over: Partial<MatchRule & { active: boolean }> = {}): MatchRule & { active: boolean } => ({
  match: 'netflix', amountMinCents: 1399, amountMaxCents: 1399, direction: 'OUT',
  cadence: 'MONTHLY', anchorOn: '2026-10-14', active: true, ...over,
})
let n = 0
const tx = (day: string, amountCents: number, over: Partial<PayTx> = {}): PayTx => ({
  id: `t${++n}`, bookedAt: day, amountCents, description: 'BETALING VIA BANCONTACT NETFLIX.COM TESTCITY', ...over,
})

console.log('-- dueDates: month-end clamp (never drifts) --')
check('31 Jan monthly clamps then snaps back',
  dueDates({ cadence: 'MONTHLY', anchorOn: '2026-01-31' }, '2026-01-01', '2026-06-30'),
  ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31', '2026-06-30'])
check('31 Jan monthly in a LEAP year gives 29 Feb',
  dueDates({ cadence: 'MONTHLY', anchorOn: '2028-01-31' }, '2028-02-01', '2028-03-31'),
  ['2028-02-29', '2028-03-31'])
check('30th monthly clamps to 28 Feb',
  dueDates({ cadence: 'MONTHLY', anchorOn: '2026-01-30' }, '2026-02-01', '2026-03-31'),
  ['2026-02-28', '2026-03-30'])
check('window starting far after the anchor still never drifts (31st, 2 years on)',
  dueDates({ cadence: 'MONTHLY', anchorOn: '2024-01-31' }, '2026-02-01', '2026-03-31'),
  ['2026-02-28', '2026-03-31'])
check('quarterly from 31 Jan',
  dueDates({ cadence: 'QUARTERLY', anchorOn: '2026-01-31' }, '2026-01-01', '2026-12-31'),
  ['2026-01-31', '2026-04-30', '2026-07-31', '2026-10-31'])

console.log('-- dueDates: yearly + leap years --')
check('yearly 29 Feb -> 28 Feb in non-leap years, 29 Feb again in 2032',
  dueDates({ cadence: 'YEARLY', anchorOn: '2028-02-29' }, '2028-01-01', '2032-12-31'),
  ['2028-02-29', '2029-02-28', '2030-02-28', '2031-02-28', '2032-02-29'])
check('yearly normal date', dueDates({ cadence: 'YEARLY', anchorOn: '2025-05-10' }, '2026-01-01', '2027-12-31'), ['2026-05-10', '2027-05-10'])

console.log('-- dueDates: anchor in the past / future --')
check('anchor long in the past, window now',
  dueDates({ cadence: 'MONTHLY', anchorOn: '2023-03-15' }, '2026-11-01', '2026-11-30'), ['2026-11-15'])
check('anchor in the FUTURE: nothing before it',
  dueDates({ cadence: 'MONTHLY', anchorOn: '2027-01-10' }, '2026-11-01', '2027-02-28'), ['2027-01-10', '2027-02-10'])
check('window entirely before the anchor is empty',
  dueDates({ cadence: 'WEEKLY', anchorOn: '2027-01-10' }, '2026-11-01', '2026-12-31'), [])
check('anchor as a Date (what Prisma returns)',
  dueDates({ cadence: 'MONTHLY', anchorOn: new Date(Date.UTC(2026, 9, 14)) }, '2026-11-01', '2026-12-31'), ['2026-11-14', '2026-12-14'])
check('window ends before it starts', dueDates({ cadence: 'MONTHLY', anchorOn: '2026-10-14' }, '2026-12-31', '2026-01-01'), [])
check('both window ends are inclusive',
  dueDates({ cadence: 'MONTHLY', anchorOn: '2026-10-14' }, '2026-11-14', '2026-12-14'), ['2026-11-14', '2026-12-14'])

console.log('-- dueDates: weekly / biweekly --')
check('weekly across a month boundary',
  dueDates({ cadence: 'WEEKLY', anchorOn: '2026-10-23' }, '2026-10-25', '2026-11-10'), ['2026-10-30', '2026-11-06'])
check('weekly across a year boundary',
  dueDates({ cadence: 'WEEKLY', anchorOn: '2026-12-18' }, '2026-12-20', '2027-01-10'), ['2026-12-25', '2027-01-01', '2027-01-08'])
check('biweekly steps of 14 days',
  dueDates({ cadence: 'BIWEEKLY', anchorOn: '2026-10-23' }, '2026-10-24', '2026-12-31'), ['2026-11-06', '2026-11-20', '2026-12-04', '2026-12-18'])
check('weekly across the DST switch stays on the same calendar days',
  dueDates({ cadence: 'WEEKLY', anchorOn: '2026-10-16' }, '2026-10-20', '2026-11-06'), ['2026-10-23', '2026-10-30', '2026-11-06'])

console.log('-- matching: the window --')
const due = '2026-11-14'
check('booked on the due date', matchPayment(item(), due, [tx('2026-11-14', -1399)])?.id, `t${n}`)
check('booked 7 days late still pays', matchPayment(item(), due, [tx('2026-11-21', -1399)]) != null, true)
check('booked 8 days late does not', matchPayment(item(), due, [tx('2026-11-22', -1399)]), null)
check('booked 3 days early pays', matchPayment(item(), due, [tx('2026-11-11', -1399)]) != null, true)
check('booked 4 days early does not', matchPayment(item(), due, [tx('2026-11-10', -1399)]), null)
check('another month\'s payment does not pay this one', matchPayment(item(), due, [tx('2026-10-14', -1399)]), null)

console.log('-- matching: amount --')
const range = item({ amountMinCents: 1000, amountMaxCents: 2000 })
check('range: lower edge fits', matchPayment(range, due, [tx(due, -1000)]) != null, true)
check('range: upper edge fits', matchPayment(range, due, [tx(due, -2000)]) != null, true)
check('range: one cent below', matchPayment(range, due, [tx(due, -999)]), null)
check('range: one cent above', matchPayment(range, due, [tx(due, -2001)]), null)
check('fixed bill: 1 cent more is not it', matchPayment(item(), due, [tx(due, -1400)]), null)
check('fixed bill: 1 cent less is not it', matchPayment(item(), due, [tx(due, -1398)]), null)

console.log('-- matching: direction, transfers, deleted, name --')
check('OUT item ignores a refund (positive)', matchPayment(item(), due, [tx(due, 1399)]), null)
const pay = item({ match: 'start people', direction: 'IN', amountMinCents: 20000, amountMaxCents: 30000, cadence: 'WEEKLY', anchorOn: '2026-11-13' })
check('IN item matches positive money', matchPayment(pay, '2026-11-13', [tx('2026-11-13', 25000, { description: 'OVERSCHRIJVING START PEOPLE LOON' })]) != null, true)
check('IN item ignores negative money', matchPayment(pay, '2026-11-13', [tx('2026-11-13', -25000, { description: 'START PEOPLE' })]), null)
check('transfer row never matches', matchPayment(item(), due, [tx(due, -1399, { isTransfer: true })]), null)
check('soft-deleted row never matches', matchPayment(item(), due, [tx(due, -1399, { deletedAt: new Date() })]), null)
check('name must match', matchPayment(item(), due, [tx(due, -1399, { description: 'SPOTIFY AB' })]), null)
check('name is found in the counterparty too', matchPayment(item(), due, [tx(due, -1399, { description: 'x', counterparty: 'Netflix International' })]) != null, true)
check('name match is case + spacing insensitive', matchPayment(item({ match: 'BANCONTACT   netflix.COM' }), due, [tx(due, -1399)]) != null, true)
check('a 2-char match matches nothing (the trap)', matchPayment(item({ match: 'ne' }), due, [tx(due, -1399)]), null)
check('null description, no counterparty: no match', matchPayment(item(), due, [tx(due, -1399, { description: null })]), null)
check('zero amount never matches', matchPayment(item(), due, [tx(due, 0)]), null)

console.log('-- one row pays at most one occurrence --')
{
  const a = tx('2026-11-14', -1399)
  const b = tx('2026-11-15', -1399)
  const got = assignPayments(item(), ['2026-11-14', '2026-12-14'], [a, b])
  check('two rows for one due date: the nearer pays, the other pays nothing', [...got.entries()].map(([d, t]) => [d, t.id]), [['2026-11-14', a.id]])
}
{
  // weekly, due 11-06 / 11-13. A row on 11-10 is in BOTH windows (+4 / -3): it
  // goes to the nearer one (11-13) and can never tick both.
  const w = item({ cadence: 'WEEKLY', anchorOn: '2026-11-06' })
  const r = tx('2026-11-10', -1399)
  const got = assignPayments(w, ['2026-11-06', '2026-11-13'], [r])
  check('one row near two due dates pays only the nearest one', [...got.entries()].map(([d, t]) => [d, t.id]), [['2026-11-13', r.id]])
  const r2 = tx('2026-11-06', -1399)
  const got2 = assignPayments(w, ['2026-11-06', '2026-11-13'], [r, r2])
  check('with a second row each due date gets its own',
    [...got2.entries()].map(([d, t]) => [d, t.id]).sort(), [['2026-11-06', r2.id], ['2026-11-13', r.id]])
  const got3 = assignPayments(w, ['2026-11-06', '2026-11-13'], [r2, r])
  check('result does not depend on the order of the rows',
    [...got3.entries()].map(([d, t]) => [d, t.id]).sort(), [...got2.entries()].map(([d, t]) => [d, t.id]).sort())
}
{
  // Equal distance: deterministic tie-break (earlier due date wins the row).
  const w = item({ cadence: 'WEEKLY', anchorOn: '2026-11-06' })
  const r = tx('2026-11-09', -1399) // +3 from 11-06, -4 (out of window) from 11-13
  check('row only in one window pays that one', [...assignPayments(w, ['2026-11-06', '2026-11-13'], [r]).keys()], ['2026-11-06'])
}
{
  // Window padding: 11-18 belongs to 11-20 (-2), not to 11-13 (+5).
  const w = item({ cadence: 'WEEKLY', anchorOn: '2026-11-06' })
  const r = tx('2026-11-18', -1399)
  const occ = occurrences(w, { from: '2026-11-13', to: '2026-11-13' }, { today: '2026-11-19', transactions: [r], settlements: [] })
  check('a row that belongs to the NEXT occurrence (outside the range) does not pay this one', [occ[0]?.dueOn, occ[0]?.transactionId], ['2026-11-13', null])
}

console.log('-- billState --')
const st = (today: string, o: { matched?: boolean; settlement?: 'SKIPPED' | 'MARKED_PAID' | null } = {}) =>
  billState({ dueOn: '2026-11-14', today, matched: o.matched ?? false, settlement: o.settlement ?? null })
check('4 days ahead = upcoming', st('2026-11-10'), 'upcoming')
check('3 days ahead = dueSoon', st('2026-11-11'), 'dueSoon')
check('due today = dueSoon', st('2026-11-14'), 'dueSoon')
check('2 days late, no row yet = dueSoon (bank may be slow)', st('2026-11-16'), 'dueSoon')
check('7 days late = still inside the late window', st('2026-11-21'), 'dueSoon')
check('8 days late, no row = overdue', st('2026-11-22'), 'overdue')
check('matched = paid, even if long ago', st('2027-03-01', { matched: true }), 'paid')
check('mark paid beats overdue', st('2026-12-30', { settlement: 'MARKED_PAID' }), 'markedPaid')
check('skip beats overdue', st('2026-12-30', { settlement: 'SKIPPED' }), 'skipped')
check('skip beats even a matching bank row', st('2026-11-14', { settlement: 'SKIPPED', matched: true }), 'skipped')
check('a real bank row beats a manual mark paid', st('2026-11-14', { settlement: 'MARKED_PAID', matched: true }), 'paid')
check('isSettled', ['paid', 'markedPaid', 'skipped', 'overdue', 'dueSoon', 'upcoming'].map((s) => isSettled(s as any)), [true, true, true, false, false, false])

console.log('-- occurrences --')
{
  const rows = [tx('2026-11-15', -1399)] // booked a day late
  const occ = occurrences(item(), { from: '2026-10-01', to: '2026-12-31' }, { today: '2026-11-20', transactions: rows, settlements: [] })
  check('monthly list with a late booking', occ.map((o) => [o.dueOn, o.state, o.paidOn]), [
    ['2026-10-14', 'overdue', null], ['2026-11-14', 'paid', '2026-11-15'], ['2026-12-14', 'upcoming', null],
  ])
  check('paid occurrence carries the transaction id', occ[1]?.transactionId, rows[0]!.id)
}
{
  const occ = occurrences(item(), { from: '2026-11-01', to: '2026-12-31' }, {
    today: '2026-12-10', transactions: [],
    settlements: [{ dueOn: '2026-11-14', kind: 'MARKED_PAID' }, { dueOn: new Date(Date.UTC(2026, 11, 14)), kind: 'SKIPPED' }],
  })
  check('mark paid + skip overrides (settlement dueOn as key or Date)', occ.map((o) => [o.dueOn, o.state]), [['2026-11-14', 'markedPaid'], ['2026-12-14', 'skipped']])
}
{
  const occ = occurrences(item(), { from: '2026-11-01', to: '2026-11-30' }, {
    today: '2026-11-14', transactions: [tx('2026-11-14', -1399)], settlements: [{ dueOn: '2026-11-14', kind: 'SKIPPED' }],
  })
  check('skipped with a matching row: skipped, row not claimed', [occ[0]?.state, occ[0]?.transactionId], ['skipped', null])
}
check('paused item (active = false) has no occurrences',
  occurrences(item({ active: false }), { from: '2026-01-01', to: '2026-12-31' }, { today: '2026-11-20', transactions: [], settlements: [] }), [])
{
  const w = item({ cadence: 'WEEKLY', anchorOn: '2026-10-30' })
  const occ = occurrences(w, { from: '2026-10-25', to: '2026-11-15' }, { today: '2026-11-04', transactions: [tx('2026-10-30', -1399)], settlements: [] })
  check('weekly across month boundary with one paid', occ.map((o) => [o.dueOn, o.state]), [
    ['2026-10-30', 'paid'], ['2026-11-06', 'dueSoon'], ['2026-11-13', 'upcoming'],
  ])
}
check('matchFetchRange pads the range', matchFetchRange('2026-11-01', '2026-11-30'), { from: '2026-10-15', to: '2026-12-21' })

console.log(`\n${pass}/${total} passed`)
process.exit(pass === total ? 0 : 1)
