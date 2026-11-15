/**
 * Tests for amount-aware merchant rules (fake data only). Run:  npx tsx ruleAmount.test.mts
 * Covers ruleMatches / pickRule / transactionLabel with an amount condition,
 * and validateRuleAmount (the POST /api/rules body check).
 */
import { ruleMatches, amountFits, validateRuleAmount } from './shared/utils/rules'
import { pickRule } from './shared/utils/rulePick'
import { transactionLabel } from './shared/utils/merchant'

const DESC = 'BETALING VIA BANCONTACT 11-09-2026 OM 03.55 UUR APPLE SERVICES.  APPLE IET23 TESTCITY MET KBC-DEBETKAART 0000 KAARTHOUDER: TEST USER'

let pass = 0
let total = 0
function check(name: string, got: unknown, want: unknown) {
  total++
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (ok) pass++
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${ok ? '' : `  (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`}`)
}

let n = 0
const rule = (match: string, label: string | null, min: number | null, max: number | null, age = 0) => ({
  id: `r${++n}`, match, label, categoryId: label ? `c-${label}` : null,
  amountMinCents: min, amountMaxCents: max,
  createdAt: new Date(2026, 0, 1 + age),
})

console.log('-- matching --')
const exact99 = { amountMinCents: 99, amountMaxCents: 99 }
check('exact 99 matches a -99 expense', ruleMatches('apple services', DESC, -99, exact99), true)
check('exact 99 matches a +99 refund (absolute value)', ruleMatches('apple services', DESC, 99, exact99), true)
check('exact 99 does not match -129', ruleMatches('apple services', DESC, -129, exact99), false)
check('name-only rule ignores amount (-129)', ruleMatches('apple services', DESC, -129, { amountMinCents: null, amountMaxCents: null }), true)
check('name-only rule, old 2-arg call', ruleMatches('apple services', DESC), true)
check('name-only rule, amount passed but no range', ruleMatches('apple services', DESC, -129), true)
check('amount fits but description does not', ruleMatches('colruyt', DESC, -99, exact99), false)
check('amount rule, amount unknown -> no match', ruleMatches('apple services', DESC, undefined, exact99), false)
check('amount rule, amount null -> no match', ruleMatches('apple services', DESC, null, exact99), false)

const range = { amountMinCents: 500, amountMaxCents: 1000 }
check('range: below min', amountFits(range, -499), false)
check('range: min inclusive', amountFits(range, -500), true)
check('range: inside', amountFits(range, -750), true)
check('range: max inclusive', amountFits(range, -1000), true)
check('range: above max', amountFits(range, -1001), false)
check('range: positive amount inside', amountFits(range, 750), true)
check('null amounts always fit', amountFits({ amountMinCents: null, amountMaxCents: null }, -123456), true)
check('missing amounts always fit', amountFits({}, -5), true)
check('zero amount vs rule min 1', amountFits({ amountMinCents: 1, amountMaxCents: 1 }, 0), false)

console.log('-- pickRule --')
const nameOnly = rule('APPLE SERVICES', 'Apple', null, null, 5)
const icloud = rule('APPLE SERVICES', 'iCloud', 99, 99, 1)
check('name+amount beats name-only (older but specific)', pickRule([nameOnly, icloud], DESC, -99)?.label, 'iCloud')
check('other amount falls back to name-only', pickRule([nameOnly, icloud], DESC, -129)?.label, 'Apple')
check('amount rule only: other amount -> none', pickRule([icloud], DESC, -129)?.label, undefined)
const longNameOnly = rule('APPLE SERVICES. APPLE', 'Long', null, null, 9)
check('amount rule beats a LONGER name-only rule', pickRule([longNameOnly, icloud], DESC, -99)?.label, 'iCloud')
check('among amount rules: longer match wins', pickRule([rule('APPLE', 'Short', 99, 99, 9), icloud], DESC, -99)?.label, 'iCloud')
check('among amount rules, same length: newest wins', pickRule([rule('APPLE SERVICES', 'Old', 99, 99, 1), rule('APPLE SERVICES', 'New', 99, 99, 7)], DESC, -99)?.label, 'New')
check('range rule picks inside range', pickRule([rule('APPLE SERVICES', 'Mid', 50, 150)], DESC, -99)?.label, 'Mid')
check('range rule skips outside range', pickRule([rule('APPLE SERVICES', 'Mid', 50, 150)], DESC, -151)?.label, undefined)
check('pickRule without amount: old behaviour for name-only', pickRule([nameOnly], DESC)?.label, 'Apple')
check('pickRule without amount: amount rule skipped', pickRule([icloud, nameOnly], DESC)?.label, 'Apple')
check('legacy rule objects without amount fields still work', pickRule([{ id: 'x', match: 'APPLE', label: 'L', categoryId: null, createdAt: '2026-01-01' }], DESC, -99)?.label, 'L')

console.log('-- transactionLabel --')
check('label: 0.99 charge -> iCloud', transactionLabel(null, DESC, [nameOnly, icloud], -99), 'iCloud')
check('label: other charge -> Apple', transactionLabel(null, DESC, [nameOnly, icloud], -129), 'Apple')
check('label: no amount passed -> name-only rule', transactionLabel(null, DESC, [nameOnly, icloud]), 'Apple')

console.log('-- validateRuleAmount --')
const ok = (min: unknown, max: unknown) => validateRuleAmount(min, max)
check('neither (undefined)', ok(undefined, undefined), { ok: true, amountMinCents: null, amountMaxCents: null })
check('neither (null)', ok(null, null), { ok: true, amountMinCents: null, amountMaxCents: null })
check('exact 99', ok(99, 99), { ok: true, amountMinCents: 99, amountMaxCents: 99 })
check('range 50..150', ok(50, 150), { ok: true, amountMinCents: 50, amountMaxCents: 150 })
check('only min -> field amountMaxCents', (ok(99, undefined) as any).field, 'amountMaxCents')
check('only max -> field amountMinCents', (ok(null, 99) as any).field, 'amountMinCents')
check('min > max rejected', ok(200, 100).ok, false)
check('zero rejected', (ok(0, 0) as any).field, 'amountMinCents')
check('negative rejected', ok(-99, -99).ok, false)
check('negative max rejected', (ok(99, -5) as any).field, 'amountMaxCents')
check('non-integer rejected', ok(0.99, 0.99).ok, false)
check('string rejected', ok('99', '99').ok, false)
check('NaN rejected', ok(NaN, NaN).ok, false)
check('too large rejected', ok(1, 3_000_000_000).ok, false)

console.log(`\n${pass}/${total} passing`)
if (pass !== total) process.exit(1)
