/**
 * Test harness for extractMerchant. Run:  npx tsx merchant.test.mts
 * Inputs are real rows from Kilian's own KBC export.
 *
 * Inputs are passed RAW - with the bank's long runs of spaces intact - so the
 * test also proves extractMerchant cleans its own input. (It used to be
 * pre-normalised here, which hid the ReDoS bug.)
 */
import { extractMerchant, transactionLabel } from './shared/utils/merchant'

const cases: { name: string; raw: string; expected: string | null }[] = [
  {
    name: 'card payment - Bancontact',
    raw: 'BETALING VIA BANCONTACT 02-09-2026 OM 12.40 UUR DIOW-BE0401 BE9051 SINT - DENIJS MET KBC-DEBETKAART 5127 88XX XXXX 7736 KAARTHOUDER: FREDERIX KILIAN',
    expected: 'DIOW-BE0401 BE9051 SINT - DENIJS',
  },
  {
    name: 'card payment - Debit Mastercard via Apple Pay',
    raw: 'BETALING VIA DEBIT MASTERCARD 05-09-2026 OM 19.06 UUR REVOLUT**7594* IED02 R296 DUBLIN MET APPLE PAY 5127 88XX XXXX 7736 VIRTUEEL KAARTNUMMER CONTACTLOZE BETALING: 5315 98XX XXXX 8093 KAARTHOUDER: FREDERIX KILIAN',
    // What the RULE can honestly find. Making it read "Revolut" is the job of
    // a taught rule (Layer 1), not this function - see the taught-rules spec.
    expected: 'REVOLUT**7594* IED02 R296 DUBLIN',
  },
  {
    name: 'direct debit - ACV',
    raw: 'EUROPESE DOMICILIERING SCHULDEISER     : ACV-CSC REF. SCHULDEISER: 0926 BIJDRAGEN 092026-092026 MANDAATREFERTE  : N00960231 MEDEDELING      : SCOR BBA 081885718765',
    expected: 'ACV-CSC',
  },
  {
    name: 'direct debit - Alpha Credit',
    raw: 'EUROPESE DOMICILIERING SCHULDEISER     : ALPHA CREDIT REF. SCHULDEISER: 118146894824 MANDAATREFERTE  : AC11814689482420250218001 MEDEDELING      : UW MAANDAFLOSSING ALPHA CREDIT11814 6894824',
    expected: 'ALPHA CREDIT',
  },
  {
    name: 'cash deposit',
    raw: 'STORTING AUTOMAAT BC KOOLMIJNLAAN, 15   BERINGEN MET KBC-DEBETKAART 5127 88XX XXXX 7736 KAARTHOUDER FREDERIX KILIAN REFERTE 000401207007442609021202',
    expected: 'Cash deposit',
  },
  {
    // Empty text is not a useful label -> "I don't know".
    name: 'empty description',
    raw: '',
    expected: null,
  },
  {
    // An unrecognised shape MUST return null, not a guess.
    name: 'unknown shape',
    raw: 'SOMETHING COMPLETELY NEW THAT YOU HAVE NOT SEEN YET',
    expected: null,
  },
]

let pass = 0
for (const c of cases) {
  const got = extractMerchant(c.raw)
  const ok = got === c.expected
  if (ok) pass++
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${c.name}`)
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(c.expected)}`)
  else console.log(`        app shows: "${transactionLabel(null, c.raw)}"`)
}

// ---- Safety regression test --------------------------------------------
// Before the guard, the direct-debit pattern took 42 SECONDS on 5,000 spaces.
// This fails loudly if anyone ever removes the guard or reintroduces an
// ambiguous pattern.
const hostile = [
  'EUROPESE DOMICILIERING SCHULDEISER : ' + ' '.repeat(50_000),
  'BETALING VIA BANCONTACT ' + 'UUR '.repeat(20_000),
]
const t0 = performance.now()
for (const h of hostile) extractMerchant(h)
const ms = performance.now() - t0
const safe = ms < 50
if (safe) pass++
console.log(`${safe ? '  PASS' : '  FAIL'}  ReDoS guard - 100k chars of hostile input in ${ms.toFixed(1)} ms (limit 50 ms)`)

const total = cases.length + 1
console.log(`\n${pass}/${total} passing`)
if (pass !== total) process.exit(1)
