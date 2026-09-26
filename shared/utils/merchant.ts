/**
 * Turn a raw KBC `Omschrijving` into something a human can scan.
 *
 * ── KILIAN WRITES THIS ONE ───────────────────────────────────────────────
 * This is the parsing/heuristics half. The plumbing around it is already
 * wired: whatever this returns becomes the transaction's label everywhere.
 *
 * WHY IT IS COMPUTED, NOT STORED
 * The result is never written to the database. Improving this function makes
 * every past import better immediately - no migration, no stale rows. Storing
 * it would mean a backfill every time you got smarter.
 *
 * THE CONTRACT
 *   in : the raw description string (may be empty)
 *   out: a short human label, or null if nothing better than the raw text
 *        can be found. Returning null is a legitimate answer - the caller
 *        falls back to truncated raw text, so a miss degrades, never breaks.
 *
 * ── REAL EXAMPLES FROM YOUR OWN EXPORT ──────────────────────────────────
 * Use these as your test cases. Run them with: npx tsx merchant.test.mts
 *
 *  1. "BETALING VIA BANCONTACT 02-09-2026 OM 12.40 UUR DIOW-BE0401 BE9051
 *      SINT - DENIJS MET KBC-DEBETKAART 5127 88XX XXXX 7736 KAARTHOUDER:
 *      FREDERIX KILIAN"
 *     → the merchant sits between "UUR" and "MET KBC-DEBETKAART"
 *
 *  2. "EUROPESE DOMICILIERING SCHULDEISER     : ACV-CSC REF. SCHULDEISER:
 *      0926 BIJDRAGEN 092026-092026 MANDAATREFERTE  : N00960231 ..."
 *     → the creditor follows "SCHULDEISER" + colon, and ends before
 *       "REF." - mind the run of spaces before the colon
 *
 *  3. "STORTING AUTOMAAT BC KOOLMIJNLAAN, 15   BERINGEN MET KBC-DEBETKAART
 *      5127 88XX XXXX 7736 KAARTHOUDER FREDERIX KILIAN REFERTE 0004012070..."
 *     → not a merchant at all. It is a cash deposit at a machine; a fixed
 *       label like "Cash deposit" is more useful than any extracted string
 *
 * ── THINGS WORTH DECIDING AS YOU GO ─────────────────────────────────────
 * - Your card number and your own name appear in almost every row. They are
 *   noise in a label and arguably shouldn't be on screen at all.
 * - Collapse runs of whitespace; KBC pads fields with many spaces.
 * - Cap the length. A label that wraps to three lines defeats the purpose.
 * - You have only 3 sample rows. Other prefixes exist (OVERSCHRIJVING, LOON,
 *   terugbetalingen…). Write it so an UNRECOGNISED shape returns null rather
 *   than guessing - a wrong label is worse than a raw one, because it looks
 *   confident.
 *
 * ── SHAPE OF THE SOLUTION (not the code) ────────────────────────────────
 * A list of { pattern, howToExtract } rules, tried in order, first match
 * wins, null if none match. Keep each rule small and independently testable;
 * you will be adding rules for months as new statement types appear.
 */
export function extractMerchant(description: string): string | null {
  
  if (description.startsWith('STORTING AUTOMAAT')) return 'Cash deposit'

  if (description.startsWith('BETALING VIA BANCONTACT')) {
    return description.match(/BETALING VIA BANCONTACT.*?UUR (.*?) MET KBC-DEBETKAART/)?.[1] ?? null
  }

  if (description.startsWith('EUROPESE DOMICILIERING SCHULDEISER')) {
    return description.match(/SCHULDEISER\s*:\s*(.*?)\s+REF\./)?.[1] ?? null
  }
  return null
}

/**
 * What the UI actually shows. PLUMBING - already done, leave it alone.
 * Prefers the bank's counterparty field when it exists (it doesn't, for KBC),
 * then your extractor, then a trimmed slice of the raw text.
 */
export function transactionLabel(
  counterparty: string | null,
  description: string | null,
): string {
  if (counterparty?.trim()) return counterparty.trim()

  const raw = (description ?? '').replace(/\s+/g, ' ').trim()
  if (!raw) return 'Transaction'

  return extractMerchant(raw) ?? (raw.length > 48 ? `${raw.slice(0, 48)}…` : raw)
}
