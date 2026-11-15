import { hasAmountCondition, ruleMatches, type RuleAmount } from './rules'

export interface RuleLike extends RuleAmount {
  id: string
  match: string
  label: string | null
  categoryId: string | null
  createdAt: Date | string
}

/**
 * When several rules match one transaction, the MOST SPECIFIC wins:
 *   1. a rule WITH an amount condition beats one WITHOUT - "APPLE SERVICES at
 *      0.99" is more specific than "APPLE SERVICES" for the same row, even if
 *      the name-only rule's text happens to be longer;
 *   2. then the longest match text - "APPLE SERVICES" beats "APPLE";
 *   3. then the newest rule - the latest thing the user taught is assumed to
 *      be what they want now.
 *
 * `amountCents` is the transaction's signed amount (negative = expense); rules
 * with an amount condition compare on its absolute value. Without it, rules
 * with an amount condition never match (see amountFits).
 *
 * Shared by server (imports, retro-apply) and client (labels), so "which rule
 * wins" can never differ between what you see and what gets stored.
 * Matching itself is ruleMatches() - one definition, used everywhere.
 */
export function pickRule<T extends RuleLike>(
  rules: T[],
  description: string | null,
  amountCents?: number | null,
): T | null {
  let best: T | null = null
  for (const r of rules) {
    if (!ruleMatches(r.match, description, amountCents, r)) continue
    if (!best || beats(r, best)) best = r
  }
  return best
}

function beats(a: RuleLike, b: RuleLike): boolean {
  const aAmt = hasAmountCondition(a)
  const bAmt = hasAmountCondition(b)
  if (aAmt !== bAmt) return aAmt
  if (a.match.length !== b.match.length) return a.match.length > b.match.length
  return new Date(a.createdAt) > new Date(b.createdAt)
}
