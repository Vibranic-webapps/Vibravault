/**
 * Tests for the transactions-insights maths. Run:  npx tsx insights.test.mts
 * Fake round numbers only - no personal data in a public repo.
 */
import {
  parseDayKey, insightsWindow, insightsBuckets, insightsRing, aggregateInsights,
  type InsightsRow, type InsightsCategoryInfo,
} from './shared/utils/insights'

const day = (s: string) => parseDayKey(s)!
const win = (kind: 'week' | 'month', anchor: string) => insightsWindow(kind, day(anchor))

const checks: { name: string; ok: boolean; detail?: unknown }[] = []
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  checks.push({ name, ok, detail: ok ? undefined : { want, got } })
}
const leftOver = (r: { leftCents: number; overCents: number }) => [r.leftCents, r.overCents]

// ---- parseDayKey ----------------------------------------------------------
eq('parseDayKey accepts a real day', parseDayKey('2026-11-15')?.toISOString(), '2026-11-15T00:00:00.000Z')
eq('parseDayKey rejects 2026-02-31 (would roll over)', parseDayKey('2026-02-31'), null)
eq('parseDayKey rejects wrong shape', parseDayKey('15-11-2026'), null)
eq('parseDayKey rejects non-string', parseDayKey(20261115), null)

// ---- windows --------------------------------------------------------------
{
  // 2026-11-15 is a Sunday: the week is Mon 9 .. Sun 15.
  const w = win('week', '2026-11-15')
  eq('week: Sunday anchor stays in its own week', [w.from, w.to], ['2026-11-09', '2026-11-15'])
  eq('week: prev/next anchors', [w.prevAnchor, w.nextAnchor], ['2026-11-02', '2026-11-16'])
  eq('week: Monday anchor', [win('week', '2026-11-09').from, win('week', '2026-11-09').to], ['2026-11-09', '2026-11-15'])
  eq('week: end bound is exclusive Monday', w.end.toISOString(), '2026-11-16T00:00:00.000Z')
}
{
  // The week of Mon 26 Oct .. Sun 1 Nov straddles two months.
  const w = win('week', '2026-10-30')
  eq('week straddling month boundary', [w.from, w.to], ['2026-10-26', '2026-11-01'])
  eq('...and its next anchor opens the next week', win('week', w.nextAnchor).from, '2026-11-02')
}
{
  const w = win('month', '2026-11-15')
  eq('month: calendar month inclusive', [w.from, w.to], ['2026-11-01', '2026-11-30'])
  eq('month: prev/next anchors', [w.prevAnchor, w.nextAnchor], ['2026-10-01', '2026-12-01'])
  eq('month: December rolls into next year', [win('month', '2026-12-31').to, win('month', '2026-12-31').nextAnchor], ['2026-12-31', '2027-01-01'])
  eq('month: January prev is December', win('month', '2027-01-10').prevAnchor, '2026-12-01')
  eq('month: leap February', win('month', '2028-02-10').to, '2028-02-29')
  eq('month: non-leap February', win('month', '2026-02-10').to, '2026-02-28')
}

// ---- buckets --------------------------------------------------------------
{
  const b = insightsBuckets(win('week', '2026-11-12'))
  eq('week series: 7 days Mon..Sun', [b.length, b[0]!.key, b[6]!.key], [7, '2026-11-09', '2026-11-15'])
  eq('week series: labels are day of month', b.map((x) => x.label), ['9', '10', '11', '12', '13', '14', '15'])
}
{
  // November 2026: 1 Nov is a Sunday -> weeks clipped at both ends.
  const b = insightsBuckets(win('month', '2026-11-10'))
  eq('month series: clipped Monday-start weeks', b.map((x) => [x.key, x.from, x.to]), [
    ['2026-10-26', '2026-11-01', '2026-11-01'],
    ['2026-11-02', '2026-11-02', '2026-11-08'],
    ['2026-11-09', '2026-11-09', '2026-11-15'],
    ['2026-11-16', '2026-11-16', '2026-11-22'],
    ['2026-11-23', '2026-11-23', '2026-11-29'],
    ['2026-11-30', '2026-11-30', '2026-11-30'],
  ])
  eq('month series: labels', b.map((x) => x.label), ['1–1', '2–8', '9–15', '16–22', '23–29', '30–30'])
}

// ---- ring -----------------------------------------------------------------
{
  const r = insightsRing(200000, 15000, 85000)
  eq('ring: slices sum exactly to income', r.subscriptionsCents + r.otherSpendCents + r.leftCents, 200000)
  eq('ring: left / over', leftOver(r), [100000, 0])
}
eq('ring overspent: left 0, over = spend - income', leftOver(insightsRing(100000, 30000, 90000)), [0, 20000])
eq('ring: spend exactly equals income', leftOver(insightsRing(1000, 400, 600)), [0, 0])
eq('ring: zero income, some spend', leftOver(insightsRing(0, 500, 700)), [0, 1200])
{
  const r = insightsRing(0, 0, 0)
  eq('ring: all zero has no -0', [Object.is(r.leftCents, 0), Object.is(r.overCents, 0)], [true, true])
}
eq('ring: odd cents stay integers', Object.values(insightsRing(100001, 33333, 33333)).every(Number.isInteger), true)

// ---- aggregate ------------------------------------------------------------
const cats: InsightsCategoryInfo[] = [
  { id: 'sub', name: 'Subscriptions', icon: 'tv', color: 'cat-9', isSubscription: true },
  { id: 'food', name: 'Groceries', icon: 'shopping-cart', color: 'cat-1', isSubscription: false },
  { id: 'wage', name: 'Wage', icon: 'briefcase', color: 'cat-5', isSubscription: false },
]
const row = (d: string, amountCents: number, categoryId: string | null, label = 'X'): InsightsRow =>
  ({ amountCents, bookedAt: day(d), categoryId, label })
{
  const rows = [
    row('2026-11-09', 200000, 'wage', 'Employer'),
    row('2026-11-10', -1299, 'sub', 'Streamly'),
    row('2026-11-12', -1299, 'sub', 'Streamly'),
    row('2026-11-12', -899, 'sub', 'Musicly'),
    row('2026-11-13', -5000, 'food', 'Shop'),
    row('2026-11-15', -700, null, 'Kiosk'),
    row('2026-11-15', 0, null, 'Zero'),
  ]
  const a = aggregateInsights(win('week', '2026-11-12'), rows, cats)
  eq('agg totals', a.totals, { incomeCents: 200000, expenseCents: -9197, netCents: 190803 })
  eq('agg subscriptions total', a.subscriptions.totalCents, 3497)
  eq('agg subscription lines sorted by size', a.subscriptions.items, [
    { label: 'Streamly', totalCents: 2598, count: 2 },
    { label: 'Musicly', totalCents: 899, count: 1 },
  ])
  eq('agg ring', a.ring, { incomeCents: 200000, subscriptionsCents: 3497, otherSpendCents: 5700, leftCents: 190803, overCents: 0 })
  eq('agg ring sums to income', a.ring.subscriptionsCents + a.ring.otherSpendCents + a.ring.leftCents, 200000)
  eq('agg categories desc, null = uncategorised', a.categories.map((c) => [c.categoryId, c.totalCents, c.isSubscription]), [
    ['food', 5000, false], ['sub', 3497, true], [null, 700, false],
  ])
  eq('agg week series has 7 days', a.series.length, 7)
  eq('agg series day sums', a.series.filter((s) => s.incomeCents || s.expenseCents).map((s) => [s.key, s.incomeCents, s.expenseCents, s.netCents]), [
    ['2026-11-09', 200000, 0, 200000],
    ['2026-11-10', 0, -1299, -1299],
    ['2026-11-12', 0, -2198, -2198],
    ['2026-11-13', 0, -5000, -5000],
    ['2026-11-15', 0, -700, -700],
  ])
  eq('agg series sums match totals', [
    a.series.reduce((n, s) => n + s.incomeCents, 0), a.series.reduce((n, s) => n + s.expenseCents, 0),
  ], [a.totals.incomeCents, a.totals.expenseCents])
}
{
  const a = aggregateInsights(win('month', '2026-11-10'), [], cats)
  eq('agg empty: zeros, no -0', [a.totals.expenseCents, a.totals.netCents].map((n) => Object.is(n, 0)), [true, true])
  eq('agg empty: month series still has all weeks', a.series.length, 6)
  eq('agg empty: no categories / subscriptions', [a.categories.length, a.subscriptions.items.length], [0, 0])
}
{
  // Overspent month: spending beats income.
  const a = aggregateInsights(win('month', '2026-11-10'), [row('2026-11-02', 10000, 'wage'), row('2026-11-03', -15000, 'food')], cats)
  eq('agg overspent ring', [a.ring.leftCents, a.ring.overCents, a.totals.netCents], [0, 5000, -5000])
}
{
  // Month series: a Sunday-1-Nov booking lands in the clipped Oct-26 week bucket.
  const a = aggregateInsights(win('month', '2026-11-10'), [row('2026-11-01', -100, 'food')], cats)
  eq('agg month series: 1 Nov goes to first clipped week', a.series[0]!.expenseCents, -100)
}

let pass = 0
for (const c of checks) {
  if (c.ok) pass++
  console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name}`)
  if (!c.ok) console.log(`        ${JSON.stringify(c.detail)}`)
}
console.log(`\n  ${pass}/${checks.length} passing`)
if (pass !== checks.length) process.exit(1)
