/**
 * Test harness for extractMerchant. Run:  npx tsx merchant.test.mts
 * Inputs are real rows from Kilian's own KBC export.
 * Edit `expected` to what YOU think each should read as, then make them pass.
 */
import { extractMerchant, transactionLabel } from './shared/utils/merchant'

const cases: { raw: string; expected: string | null }[] = [
  {
    raw: 'BETALING VIA BANCONTACT 02-09-2026 OM 12.40 UUR DIOW-BE0401 BE9051 SINT - DENIJS MET KBC-DEBETKAART 5127 88XX XXXX 7736 KAARTHOUDER: FREDERIX KILIAN',
    expected: 'DIOW-BE0401 BE9051 SINT - DENIJS',
  },
  {
    raw: 'EUROPESE DOMICILIERING SCHULDEISER     : ACV-CSC REF. SCHULDEISER: 0926 BIJDRAGEN 092026-092026 MANDAATREFERTE  : N00960231 MEDEDELING      : SCOR BBA 081885718765',
    expected: 'ACV-CSC',
  },
  {
    raw: 'STORTING AUTOMAAT BC KOOLMIJNLAAN, 15   BERINGEN MET KBC-DEBETKAART 5127 88XX XXXX 7736 KAARTHOUDER FREDERIX KILIAN REFERTE 000401207007442609021202',
    expected: 'Cash deposit',
  },
  {
    raw: 'INSTANTOVERSCHRIJVING VAN BE63 6504 5981 6908 BANKIER OPDRACHTGEVER: REVOBEB2XXX KILIAN FREDERIX REFERENTIE: NOTPROVIDED OM 13.08 UUR',
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
