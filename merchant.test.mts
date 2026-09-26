/**
 * Test harness for extractMerchant. Run:  npx tsx merchant.test.mts
 * Inputs are real rows from Kilian's own KBC export.
 * Edit `expected` to what YOU think each should read as, then make them pass.
 */
import { extractMerchant, transactionLabel } from './shared/utils/merchant'

const cases: { raw: string; expected: string | null }[] = [
  {
    raw: 'BETALING VIA BANCONTACT 02-09-2026 OM 12.40 UUR TESTWINKEL BE0001 TESTGEMEENTE MET KBC-DEBETKAART 0000 00XX XXXX 0000 KAARTHOUDER: TEST USER',
    expected: 'TESTWINKEL BE0001 TESTGEMEENTE',
  },
  {
    raw: 'EUROPESE DOMICILIERING SCHULDEISER     : TESTVAKBOND REF. SCHULDEISER: 0926 BIJDRAGEN 092026-092026 MANDAATREFERTE  : N00000000 MEDEDELING      : SCOR BBA 000000000000',
    expected: 'TESTVAKBOND',
  },
  {
    raw: 'STORTING AUTOMAAT BC TESTSTRAAT 1   TESTGEMEENTE MET KBC-DEBETKAART 0000 00XX XXXX 0000 KAARTHOUDER TEST USER REFERTE 000000000000000000000000',
    expected: 'Cash deposit',
  },
  {
    raw: 'INSTANTOVERSCHRIJVING VAN BE00 0000 0000 0000 BANKIER OPDRACHTGEVER: REVOBEB2XXX TEST USER REFERENTIE: NOTPROVIDED OM 13.08 UUR',
    expected: 'INSTANTOVERSCHRIJVING ',
  },
  {
    raw: '',
    expected: ''
  },
  {
    raw: '',
    expected: ''
  },
  // An unrecognised shape MUST return null, not a guess.
  { raw: 'SOMETHING COMPLETELY NEW THAT YOU HAVE NOT SEEN YET', expected: null },
]

let pass = 0
for (const c of cases) {
  const got = extractMerchant(c.raw.replace(/\s+/g, ' ').trim())
  const ok = got === c.expected
  if (ok) pass++
  console.log(`${ok ? '  PASS' : '  FAIL'}  got: ${JSON.stringify(got)}`)
  if (!ok) console.log(`        want: ${JSON.stringify(c.expected)}`)
  console.log(`        label shown in the app: "${transactionLabel(null, c.raw)}"`)
}
console.log(`\n${pass}/${cases.length} passing`)
