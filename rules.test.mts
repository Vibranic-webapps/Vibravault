/**
 * Tests for ruleMatches. Run:  npx tsx rules.test.mts
 * Goal: all passing. Read every case BEFORE writing code - one of them is the
 * trap described in rules.ts.
 */
import { ruleMatches } from './shared/utils/rules'

// Descriptions in the shape of real KBC rows (names and card numbers replaced).
const APPLE = 'BETALING VIA BANCONTACT 11-09-2026 OM 03.55 UUR APPLE SERVICES.  APPLE IET23 YK84 HOLLYHILL MET KBC-DEBETKAART 0000 00XX XXXX 0000 KAARTHOUDER: TEST USER'
const REVOLUT = 'BETALING VIA DEBIT MASTERCARD 05-09-2026 OM 19.06 UUR REVOLUT**7594* IED02 R296 DUBLIN MET APPLE PAY 0000 00XX XXXX 0000'
const LOAN = 'EUROPESE DOMICILIERING SCHULDEISER     : ALPHA CREDIT REF. SCHULDEISER: 000000000000'

const cases: { name: string; match: string; description: string | null; expected: boolean }[] = [
  // --- the basic job -------------------------------------------------------
  { name: 'exact text is found',             match: 'APPLE SERVICES',  description: APPLE,   expected: true },
  { name: 'text that is not there',           match: 'COLRUYT',         description: APPLE,   expected: false },
  { name: 'part of a longer name',            match: 'REVOLUT',         description: REVOLUT, expected: true },

  // --- case must not matter -----------------------------------------------
  { name: 'lowercase typed, uppercase bank',  match: 'apple services',  description: APPLE,   expected: true },
  { name: 'mixed case typed',                 match: 'Alpha Credit',    description: LOAN,    expected: true },

  // --- spacing must not matter --------------------------------------------
  // The bank wrote "SCHULDEISER     :" with five spaces. You typed one.
  { name: 'bank padded with many spaces',     match: 'SCHULDEISER : ALPHA', description: LOAN, expected: true },
  // You typed a double space by accident.
  { name: 'you typed a double space',         match: 'APPLE  SERVICES', description: APPLE,   expected: true },

  // --- nothing to compare against -----------------------------------------
  { name: 'no description at all',           match: 'APPLE',           description: null,    expected: false },
  { name: 'empty description',                match: 'APPLE',           description: '',      expected: false },

  // --- THE TRAP -----------------------------------------------------------
  // Think hard about these two before writing anything. What does
  // "APPLE SERVICES".includes("") return in JavaScript? Try it.
  { name: 'empty rule text',                  match: '',                description: APPLE,   expected: false },
  { name: 'rule text that is only spaces',    match: '     ',           description: APPLE,   expected: false },
]

let pass = 0
for (const c of cases) {
  const got = ruleMatches(c.match, c.description)
  const ok = got === c.expected
  if (ok) pass++
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${c.name}${ok ? '' : `  (got ${got}, want ${c.expected})`}`)
}
console.log(`\n${pass}/${cases.length} passing`)
if (pass !== cases.length) process.exit(1)
