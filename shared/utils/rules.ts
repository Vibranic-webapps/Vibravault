function clean(text: string | null): string {
  return (text ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
}

const MIN_MATCH_LENGTH = 3

/**
 * The optional amount condition of a rule (MerchantRule.amountMinCents /
 * amountMaxCents). Both null/undefined = "any amount". An exact amount X is
 * min = max = X; a range is min < max, both ends inclusive.
 *
 * The condition is on the ABSOLUTE value of the transaction: a 0.99 charge is
 * stored as amountCents = -99, but the rule says 99 (what the user typed). So
 * a rule for 99 matches both -99 (the payment) and +99 (a refund of it).
 */
export interface RuleAmount {
  amountMinCents?: number | null
  amountMaxCents?: number | null
}

/** Does the rule carry an amount condition at all? */
export function hasAmountCondition(rule: RuleAmount): boolean {
  return rule.amountMinCents != null || rule.amountMaxCents != null
}

/**
 * Does a transaction amount fit the rule's amount condition?
 * - no condition on the rule: always true (name-only rules are unchanged)
 * - condition but unknown amount (caller did not pass one): false - we cannot
 *   prove it fits, and mislabelling a row is worse than leaving it alone
 */
export function amountFits(rule: RuleAmount, amountCents: number | null | undefined): boolean {
  if (!hasAmountCondition(rule)) return true
  if (amountCents == null) return false
  const abs = Math.abs(amountCents)
  if (rule.amountMinCents != null && abs < rule.amountMinCents) return false
  if (rule.amountMaxCents != null && abs > rule.amountMaxCents) return false
  return true
}

/**
 * A rule matches when the description matches (case- and spacing-insensitive
 * "contains", min 3 chars) AND - if the rule has an amount condition - the
 * transaction amount fits it. `amountCents` / `amount` are optional so every
 * description-only caller keeps working unchanged.
 */
export function ruleMatches(
  match: string,
  description: string | null,
  amountCents?: number | null,
  amount?: RuleAmount,
): boolean {
  const needle = clean(match)

  if (needle.length < MIN_MATCH_LENGTH) return false

  const haystack = clean(description)
  if (!haystack) return false

  if (!haystack.includes(needle)) return false

  return amount ? amountFits(amount, amountCents) : true
}

/** Postgres INT ceiling - a bigger number would be a 500 from the database, not a clear 400. */
const MAX_AMOUNT_CENTS = 2_147_483_647

export type RuleAmountResult =
  | { ok: true; amountMinCents: number | null; amountMaxCents: number | null }
  | { ok: false; field: 'amountMinCents' | 'amountMaxCents'; message: string }

/**
 * Validate the optional amount condition of a new rule (the request body).
 * Both fields are in CENTS, positive (absolute value, see RuleAmount).
 * - neither given (undefined / null / ''): ok, no condition (any amount)
 * - both given: integers >= 1, min <= max
 * - only one given: rejected - an exact amount is min = max = X
 */
export function validateRuleAmount(min: unknown, max: unknown): RuleAmountResult {
  const given = (v: unknown) => v !== undefined && v !== null && v !== ''
  const hasMin = given(min)
  const hasMax = given(max)

  if (!hasMin && !hasMax) return { ok: true, amountMinCents: null, amountMaxCents: null }
  if (hasMin !== hasMax) {
    return {
      ok: false,
      field: hasMin ? 'amountMaxCents' : 'amountMinCents',
      message: 'Give both amountMinCents and amountMaxCents (an exact amount is the same number twice)',
    }
  }

  for (const [field, v] of [['amountMinCents', min], ['amountMaxCents', max]] as const) {
    if (typeof v !== 'number' || !Number.isInteger(v)) {
      return { ok: false, field, message: 'Amount must be a whole number of cents' }
    }
    if (v < 1) return { ok: false, field, message: 'Amount must be at least 1 cent' }
    if (v > MAX_AMOUNT_CENTS) return { ok: false, field, message: 'Amount is too large' }
  }

  if ((min as number) > (max as number)) {
    return { ok: false, field: 'amountMinCents', message: 'Minimum amount cannot be higher than the maximum' }
  }
  return { ok: true, amountMinCents: min as number, amountMaxCents: max as number }
}
