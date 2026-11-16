/**
 * Tests for recurring suggestions (invented merchants and amounts only). Run:  npx tsx recurringSuggestions.test.mts
 * Covers cadence detection (weekly, biweekly, monthly, quarterly, yearly), amount
 * clusters, false positives (varying shop, irregular gaps, stopped), tracked items,
 * the 30-day "Not now" memory, transfers/deleted rows, the cap, key stability and
 * month-end dates.
 */
import {
  detectSuggestions, detectCadence, suggestionLookbackFrom, suggestionKey, parseSuggestionKey,
  SUGGESTION_MAX, type SuggestionTx, type ExistingItemLike, type DismissalLike,
} from './shared/utils/recurringSuggestions'
import { addDaysKey } from './shared/utils/recurring'

let pass = 0
let total = 0
function check(name: string, got: unknown, want: unknown) {
  total++
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (ok) pass++
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${ok ? '' : `  (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`}`)
}

const TODAY = '2026-11-16'
let n = 0
/** A bank row. Negative cents = money out. The merchant is the counterparty. */
const tx = (day: string, cents: number, merchant: string | null = 'Testflix', over: Partial<SuggestionTx> = {}): SuggestionTx => ({
  id: `t${String(++n).padStart(4, '0')}`, bookedAt: day, amountCents: cents, counterparty: merchant,
  description: 'Invented description', ...over,
})
/** The same booking every `step` days, `count` times, the last one on `last`. */
const every = (step: number, count: number, last: string, cents: number, merchant: string | null = 'Testflix', over: Partial<SuggestionTx> = {}) =>
  Array.from({ length: count }, (_, i) => tx(addDaysKey(last, -step * (count - 1 - i)), cents, merchant, over))
const monthly = (days: string[], cents: number, merchant = 'Testflix', over: Partial<SuggestionTx> = {}) =>
  days.map((d) => tx(d, cents, merchant, over))
const run = (transactions: SuggestionTx[], extra: { existing?: ExistingItemLike[]; dismissals?: DismissalLike[]; today?: string } = {}) =>
  detectSuggestions({ transactions, existing: extra.existing ?? [], dismissals: extra.dismissals ?? [], today: extra.today ?? TODAY })

const MONTHS_5 = ['2026-07-14', '2026-08-14', '2026-09-14', '2026-10-14', '2026-11-14']

console.log('-- monthly --')
{
  const s = run(monthly(MONTHS_5, -1399))
  check('clean monthly: one suggestion', s.length, 1)
  check('shape', s[0], {
    key: 'OUT|testflix|1399', name: 'Testflix', match: 'Testflix', direction: 'OUT', cadence: 'MONTHLY',
    amountMinCents: 1399, amountMaxCents: 1399, anchorOn: '2026-11-14', categoryId: null, occurrences: 5,
    seenOn: ['2026-09-14', '2026-10-14', '2026-11-14'],
  })
  check('3 bookings are enough', run(monthly(['2026-09-14', '2026-10-14', '2026-11-14'], -1399)).length, 1)
  check('2 monthly bookings are NOT enough', run(monthly(['2026-10-14', '2026-11-14'], -1399)).length, 0)
  // 06-14 07-14 08-14 09-17 10-14 (gaps 30 31 34 27): one late booking in 4 gaps is forgiven.
  check('one late booking among 4 gaps is forgiven',
    run(monthly(['2026-06-14', '2026-07-14', '2026-08-14', '2026-09-17', '2026-10-14'], -1399, 'Testflix')).map((x) => x.cadence), ['MONTHLY'])
  check('a skipped month (one 60-day gap) among 5 gaps is forgiven',
    run(monthly(['2026-04-14', '2026-05-14', '2026-06-14', '2026-08-14', '2026-09-14', '2026-10-14'], -1399)).map((x) => x.cadence), ['MONTHLY'])
  check('a late booking with only 3 bookings (gaps 34 + 27) is NOT forgiven',
    run(monthly(['2026-08-14', '2026-09-17', '2026-10-14'], -1399)).length, 0)
  check('last booking exactly 46 days ago still counts as alive (1.5 x 31)',
    run(monthly(['2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01'], -1399)).length, 1)
  check('last booking 47 days ago: stopped', run(monthly(['2026-07-31', '2026-08-31', '2026-09-30'], -1399)).length, 0)
}

console.log('-- other cadences --')
{
  const pay = run(every(7, 6, '2026-11-13', 41000, 'Teststaff Interim').map((t) => ({ ...t, amountCents: 41000 })))
  check('weekly pay (IN)', pay.map((x) => [x.direction, x.cadence, x.occurrences, x.key]), [['IN', 'WEEKLY', 6, 'IN|teststaff interim|41000']])
  check('weekly with 6-8 day jitter', run([
    tx('2026-10-02', -500, 'Testgym'), tx('2026-10-09', -500, 'Testgym'), tx('2026-10-15', -500, 'Testgym'),
    tx('2026-10-23', -500, 'Testgym'), tx('2026-10-30', -500, 'Testgym'), tx('2026-11-06', -500, 'Testgym'),
  ]).map((x) => x.cadence), ['WEEKLY'])
  check('biweekly', run(every(14, 5, '2026-11-06', -2500, 'Testlease')).map((x) => x.cadence), ['BIWEEKLY'])
  check('biweekly gaps of 12 and 16 days still fit', run([
    tx('2026-10-02', -2500, 'Testlease'), tx('2026-10-14', -2500, 'Testlease'), tx('2026-10-30', -2500, 'Testlease'), tx('2026-11-11', -2500, 'Testlease'),
  ]).map((x) => x.cadence), ['BIWEEKLY'])
  check('quarterly', run(monthly(['2026-02-01', '2026-05-01', '2026-08-01', '2026-11-01'], -8900, 'Testinsure')).map((x) => x.cadence), ['QUARTERLY'])
  check('quarterly last seen 129 days ago is alive (< 138)', run(monthly(['2025-10-10', '2026-01-10', '2026-04-10', '2026-07-10'], -8900, 'Testinsure')).length, 1)
  check('quarterly last seen 168 days ago has stopped', run(monthly(['2025-09-01', '2025-12-01', '2026-03-01', '2026-06-01'], -8900, 'Testinsure')).length, 0)
  const yearly = run(monthly(['2024-10-20', '2025-10-20'], -6000, 'Testclub'))
  check('yearly needs only 2 hits', yearly.map((x) => [x.cadence, x.occurrences, x.anchorOn]), [['YEARLY', 2, '2025-10-20']])
  check('a single yearly hit is not a pattern', run(monthly(['2025-10-20'], -6000, 'Testclub')).length, 0)
  check('two bookings a year and a half apart are not yearly', run(monthly(['2024-10-20', '2026-04-20'], -6000, 'Testclub')).length, 0)
  check('two bookings 3 months apart are not enough', run(monthly(['2026-08-01', '2026-11-01'], -8900, 'Testinsure')).length, 0)
}

console.log('-- gap ranges (detectCadence) --')
{
  const gap = (g: number) => detectCadence(['2026-01-01', addDaysKey('2026-01-01', g), addDaysKey('2026-01-01', 2 * g)])
  check('5 days: none', gap(5), null)
  check('6 days: weekly', gap(6), 'WEEKLY')
  check('8 days: weekly', gap(8), 'WEEKLY')
  check('9 days: none', gap(9), null)
  check('11 days: none', gap(11), null)
  check('12 and 16 days: biweekly', [gap(12), gap(16)], ['BIWEEKLY', 'BIWEEKLY'])
  check('17-27 days: none', [gap(17), gap(22), gap(27)], [null, null, null])
  check('28 and 34 days: monthly', [gap(28), gap(34)], ['MONTHLY', 'MONTHLY'])
  check('35 days: none', gap(35), null)
  check('85 and 96 days: quarterly', [gap(85), gap(96)], ['QUARTERLY', 'QUARTERLY'])
  check('97 days: none', gap(97), null)
  check('355 and 375 days: yearly', [detectCadence(['2024-01-01', addDaysKey('2024-01-01', 355)]), detectCadence(['2024-01-01', addDaysKey('2024-01-01', 375)])], ['YEARLY', 'YEARLY'])
  check('same-day duplicates are a bad gap', detectCadence(['2026-01-01', '2026-01-01', '2026-02-01']), null)
}

console.log('-- amount clusters --')
{
  const rows = [...monthly(MONTHS_5, -99, 'Testapple'), ...monthly(MONTHS_5, -499, 'Testapple')]
  const s = run(rows)
  check('0,99 and 4,99 from one merchant are two suggestions', s.map((x) => x.key).sort(), ['OUT|testapple|499', 'OUT|testapple|99'])
  check('a 20 cent price drift stays one suggestion',
    run([tx('2026-08-14', -999), tx('2026-09-14', -1019), tx('2026-10-14', -999), tx('2026-11-14', -1019)]).map((x) => [x.occurrences, x.amountMinCents, x.amountMaxCents]),
    [[4, 999, 1019]])
  check('within 50 cents is one cluster even when that is over 10%',
    run([tx('2026-08-14', -99), tx('2026-09-14', -129), tx('2026-10-14', -99), tx('2026-11-14', -129)]).length, 1)
  check('10% of a big amount is the tolerance (100,00 vs 109,00 together)',
    run([tx('2026-08-14', -10000), tx('2026-09-14', -10900), tx('2026-10-14', -10000), tx('2026-11-14', -10900)]).length, 1)
  check('too far apart for one cluster (1000 vs 1300) so neither has 3 hits',
    run([tx('2026-07-14', -1000), tx('2026-08-14', -1300), tx('2026-09-14', -1000), tx('2026-10-14', -1300)]).length, 0)
  check('same merchant, IN and OUT are separate',
    run([...monthly(MONTHS_5, -2000, 'Testbank'), ...monthly(MONTHS_5, 2000, 'Testbank')]).map((x) => x.direction).sort(), ['IN', 'OUT'])
  check('merchant grouping ignores case and spacing',
    run([tx('2026-09-14', -700, 'TESTFLIX  PLUS'), tx('2026-10-14', -700, 'testflix plus'), tx('2026-11-14', -700, 'Testflix Plus')]).map((x) => [x.key, x.occurrences]),
    [['OUT|testflix plus|700', 3]])
}

console.log('-- false positives --')
{
  const shop = [['2026-09-28', -1230], ['2026-10-05', -2310], ['2026-10-12', -870], ['2026-10-19', -4400], ['2026-10-26', -1890], ['2026-11-02', -3150], ['2026-11-09', -2700]]
    .map(([d, c]) => tx(d as string, c as number, 'Testmart'))
  check('weekly shop with varying baskets: nothing', run(shop).length, 0)
  check('a shop visited on irregular days, same price: nothing',
    run([tx('2026-08-03', -450, 'Testbakery'), tx('2026-08-19', -450, 'Testbakery'), tx('2026-09-24', -450, 'Testbakery'), tx('2026-10-02', -450, 'Testbakery'), tx('2026-11-11', -450, 'Testbakery')]).length, 0)
  check('irregular gaps: nothing', run([tx('2026-08-01', -1000), tx('2026-09-20', -1000), tx('2026-10-02', -1000), tx('2026-11-12', -1000)]).length, 0)
  check('stopped long ago: nothing', run(monthly(['2025-10-14', '2025-11-14', '2025-12-14', '2026-01-14'], -1399)).length, 0)
  check('rows older than 26 months do not count', run(monthly(['2024-01-14', '2024-02-14', '2024-03-14'], -1399)).length, 0)
  check('future-dated rows are ignored', run([tx('2026-11-30', -1399), tx('2026-12-30', -1399), tx('2027-01-30', -1399)]).length, 0)
  check('a merchant name under 3 characters is skipped', run(monthly(MONTHS_5, -1399, 'ab')).length, 0)
  check('no merchant text at all is skipped', run(monthly(MONTHS_5, -1399, null, { description: '' })).length, 0)
  check('a zero amount is never counted', run(monthly(MONTHS_5, 0)).length, 0)
  check('cash deposit label that is not in the row text cannot be suggested',
    run(monthly(MONTHS_5, 5000, null, { description: 'STORTING AUTOMAAT 0001 BRUSSELS' })).length, 0)
  check('nothing at all is fine', run([]).length, 0)
}

console.log('-- transfers and deleted rows --')
{
  check('transfer rows (isTransfer) never count', run(monthly(MONTHS_5, -5000, 'Testsavings', { isTransfer: true })).length, 0)
  check('transfer rows (category kind) never count', run(monthly(MONTHS_5, -5000, 'Testsavings', { categoryKind: 'TRANSFER' })).length, 0)
  check('soft-deleted rows never count', run(monthly(MONTHS_5, -5000, 'Testsavings', { deletedAt: new Date('2026-11-01') })).length, 0)
  check('a transfer row cannot be the third hit',
    run([tx('2026-09-14', -900), tx('2026-10-14', -900), tx('2026-11-14', -900, 'Testflix', { isTransfer: true })]).length, 0)
  check('a deleted row cannot be the third hit',
    run([tx('2026-09-14', -900), tx('2026-10-14', -900), tx('2026-11-14', -900, 'Testflix', { deletedAt: new Date() })]).length, 0)
}

console.log('-- already tracked --')
{
  const rows = monthly(MONTHS_5, -1399)
  const item = (over: Partial<ExistingItemLike> = {}): ExistingItemLike => ({ match: 'testflix', amountMinCents: 1399, amountMaxCents: 1399, direction: 'OUT', ...over })
  check('exact tracked bill: not suggested', run(rows, { existing: [item()] }).length, 0)
  check('paused items count too (the caller passes every item)', run(rows, { existing: [{ ...item(), active: false } as ExistingItemLike] }).length, 0)
  check('match is case-insensitive "contains"', run(rows, { existing: [item({ match: 'TESTFL' })] }).length, 0)
  check('range around the amount covers it', run(rows, { existing: [item({ amountMinCents: 1200, amountMaxCents: 1500 })] }).length, 0)
  check('same name but a different amount is still suggested (Apple 4,99 vs tracked 0,99)',
    run(monthly(MONTHS_5, -499, 'Testapple'), { existing: [item({ match: 'testapple', amountMinCents: 99, amountMaxCents: 99 })] }).length, 1)
  check('other direction does not cover it', run(rows, { existing: [item({ direction: 'IN' })] }).length, 1)
  check('another merchant does not cover it', run(rows, { existing: [item({ match: 'other' })] }).length, 1)
  check('a tracked item only hides ITS cluster', run([...rows, ...monthly(MONTHS_5, -4999, 'Testflix')], { existing: [item()] }).map((x) => x.key), ['OUT|testflix|4999'])
  check('item matches on the description too', run(monthly(MONTHS_5, -1399, null, { description: 'DOMICILIERING TESTFLIX REF 1' }), { existing: [item()] }).length, 0)
}

console.log('-- "Not now" memory (30 days) --')
{
  const rows = monthly(MONTHS_5, -1399)
  const dis = (on: string, key = 'OUT|testflix|1399'): DismissalLike => ({ key, dismissedOn: on })
  check('dismissed 10 days ago: hidden', run(rows, { dismissals: [dis('2026-11-06')] }).length, 0)
  check('dismissed today: hidden', run(rows, { dismissals: [dis('2026-11-16')] }).length, 0)
  check('dismissed 29 days ago: hidden', run(rows, { dismissals: [dis('2026-10-18')] }).length, 0)
  check('dismissed exactly 30 days ago: shown again', run(rows, { dismissals: [dis('2026-10-17')] }).length, 1)
  check('dismissed 31 days ago: shown again', run(rows, { dismissals: [dis('2026-10-16')] }).length, 1)
  check('dismissals are compared as plain dates (Date input works)', run(rows, { dismissals: [{ key: 'OUT|testflix|1399', dismissedOn: new Date('2026-11-06T00:00:00Z') }] }).length, 0)
  check('another key does not hide it', run(rows, { dismissals: [dis('2026-11-06', 'OUT|testflix|499')] }).length, 1)
  check('another merchant does not hide it', run(rows, { dismissals: [dis('2026-11-06', 'OUT|other|1399')] }).length, 1)
  check('another direction does not hide it', run(rows, { dismissals: [dis('2026-11-06', 'IN|testflix|1399')] }).length, 1)
  check('a few cents of median drift still counts as the same suggestion', run(rows, { dismissals: [dis('2026-11-06', 'OUT|testflix|1380')] }).length, 0)
  check('an old and a fresh dismissal: the fresh one wins', run(rows, { dismissals: [dis('2026-01-01'), dis('2026-11-06')] }).length, 0)
  check('a garbage key is ignored', run(rows, { dismissals: [dis('2026-11-06', 'nonsense')] }).length, 1)
}

console.log('-- cap and order --')
{
  const names = ['Testa', 'Testb', 'Testc', 'Testd', 'Teste', 'Testf', 'Testg']
  const rows = names.flatMap((m, i) => monthly(MONTHS_5.slice(i === 3 ? 0 : 1), -(1000 + i * 700), m))
  const s = run(rows)
  check('capped at 5', s.length, SUGGESTION_MAX)
  check('most occurrences first', s[0]!.name, 'Testd')
  check('then equal counts keep a stable order', s.slice(1).map((x) => x.occurrences), [4, 4, 4, 4])
  const recent = run([...monthly(['2026-08-14', '2026-09-14', '2026-10-14'], -1000, 'Testold'), ...monthly(['2026-08-20', '2026-09-20', '2026-10-20'], -2000, 'Testnew')])
  check('equal occurrences: the most recent booking first', recent.map((x) => x.name), ['Testnew', 'Testold'])
}

console.log('-- key stability --')
{
  const rows = monthly(MONTHS_5, -1399)
  const a = run(rows)[0]!.key
  check('key is direction|merchant|median', a, 'OUT|testflix|1399')
  check('same input, same key', run(rows)[0]!.key, a)
  check('input order does not matter', run([...rows].reverse())[0]!.key, a)
  check('one more booking at the same price keeps the key', run([...rows, tx('2026-06-14', -1399)])[0]!.key, a)
  check('median of an even cluster is rounded', run([tx('2026-08-14', -1000), tx('2026-09-14', -1011), tx('2026-10-14', -1000), tx('2026-11-14', -1011)])[0]!.key, 'OUT|testflix|1006')
  check('suggestionKey / parseSuggestionKey round-trip', parseSuggestionKey(suggestionKey('IN', 'a|b c', 4200)), { direction: 'IN', merchant: 'a|b c', typicalCents: 4200 })
  check('parseSuggestionKey rejects junk', [parseSuggestionKey('x'), parseSuggestionKey('OUT|a'), parseSuggestionKey('UP|a|1'), parseSuggestionKey('OUT|a|1.5')], [null, null, null, null])
}

console.log('-- month-end dates --')
{
  const s = run(monthly(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31', '2026-06-30'], -2200, 'Testrent'), { today: '2026-07-05' })
  check('31st-of-the-month bill (28/31/30 day gaps) is monthly', s.map((x) => [x.cadence, x.anchorOn, x.occurrences]), [['MONTHLY', '2026-06-30', 6]])
  check('leap year February', run(monthly(['2028-01-31', '2028-02-29', '2028-03-31'], -2200, 'Testrent'), { today: '2028-04-10' }).map((x) => x.cadence), ['MONTHLY'])
  check('bookings that straddle New Year', run(monthly(['2025-11-30', '2025-12-31', '2026-01-31'], -2200, 'Testrent'), { today: '2026-02-10' }).map((x) => x.cadence), ['MONTHLY'])
  check('lookback: same day of month, 26 months back', suggestionLookbackFrom('2026-11-16'), '2024-09-16')
  check('lookback clamps to the target month (30 Apr 2026 -> 29 Feb 2024)', suggestionLookbackFrom('2026-04-30'), '2024-02-29')
  check('lookback clamps (31 May -> 31 Mar)', suggestionLookbackFrom('2026-05-31'), '2024-03-31')
  check('lookback across a year boundary', suggestionLookbackFrom('2026-01-10'), '2023-11-10')
}

console.log('-- category, name and match --')
{
  const rows = [
    ...monthly(MONTHS_5.slice(0, 3), -1399, 'Testflix', { categoryId: 'cat-fun', categoryKind: 'EXPENSE' }),
    ...monthly(MONTHS_5.slice(3), -1399, 'Testflix', { categoryId: 'cat-home', categoryKind: 'EXPENSE' }),
  ]
  check('most common fitting category wins', run(rows)[0]!.categoryId, 'cat-fun')
  check('tie goes to the most recent category', run(monthly(MONTHS_5.slice(1), -1399, 'Testflix').map((t, i) => ({ ...t, categoryId: i < 2 ? 'cat-a' : 'cat-b', categoryKind: 'EXPENSE' as const })))[0]!.categoryId, 'cat-b')
  check('an INCOME category on a bill is ignored', run(monthly(MONTHS_5, -1399, 'Testflix', { categoryId: 'cat-in', categoryKind: 'INCOME' }))[0]!.categoryId, null)
  check('an EXPENSE category on income is ignored', run(monthly(MONTHS_5, 1399, 'Testflix', { categoryId: 'cat-out', categoryKind: 'EXPENSE' }))[0]!.categoryId, null)
  check('income takes an INCOME category', run(monthly(MONTHS_5, 1399, 'Testflix', { categoryId: 'cat-in', categoryKind: 'INCOME' }))[0]!.categoryId, 'cat-in')
  check('a category without a known kind is ignored', run(monthly(MONTHS_5, -1399, 'Testflix', { categoryId: 'cat-x' }))[0]!.categoryId, null)

  const long = 'Testflix International Streaming Services Belgium BV'
  const s = run(monthly(MONTHS_5, -1399, long))[0]!
  check('name is cut to 40 chars', [s.name.length, s.name.endsWith('…')], [40, true])
  check('match keeps the full text (still a real substring)', s.match, long)
  check('match is capped at 80 chars', run(monthly(MONTHS_5, -1399, 'T'.repeat(120)))[0]!.match.length, 80)

  const viaDesc = run(monthly(MONTHS_5, -999, 'Bank Shown Name', { description: 'BETALING VIA BANCONTACT 14-10-2026 OM 10.15 UUR TESTSTREAM BE0001 TESTCITY MET KBC-DEBETKAART 0000 KAARTHOUDER: TEST USER' }))[0]!
  check('merchant comes from the description like "Repeats..." does', [viaDesc.match, viaDesc.key], ['TESTSTREAM BE0001 TESTCITY', 'OUT|teststream be0001 testcity|999'])
  check('name uses the transaction label (counterparty first)', viaDesc.name, 'Bank Shown Name')
  const viaDom = run(monthly(MONTHS_5, -999, null, { description: 'EUROPESE DOMICILIERING SCHULDEISER     : TESTPOWER NV REF. SCHULDEISER: 000123' }))[0]!
  check('direct-debit creditor is the merchant', viaDom.match, 'TESTPOWER NV')
}

console.log(`\n${pass}/${total} passed`)
if (pass !== total) process.exit(1)
