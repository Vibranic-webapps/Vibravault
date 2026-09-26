/**
 * Does a taught rule apply to this transaction?
 *
 * ── KILIAN WRITES THIS ONE ───────────────────────────────────────────────
 * You tap a row, type "APPLE SERVICES" as the thing to look for, and name it
 * "Apple". This function decides, for every past and future transaction,
 * whether that rule applies to it.
 *
 * THE CONTRACT
 *   in : match       - the text you typed when creating the rule
 *        description - the bank's raw description (may be null or empty)
 *   out: true if the description CONTAINS the match text, else false
 *
 * THE RULES OF "CONTAINS" HERE
 *   - Case must not matter:   "apple services" finds "APPLE SERVICES"
 *   - Spacing must not matter: the bank pads with runs of spaces, and you
 *     might type a double space by accident. Both sides need the same cleanup
 *     you already wrote once in extractMerchant.
 *
 * WHY "CONTAINS" AND NOT REGEX
 *   A regex typed into a text box is a ReDoS hole - you just saw one take 42
 *   seconds. "Contains" can't backtrack, so it's safe with anything typed.
 *
 * THE TRAP - read the test file before you write anything
 *   There is one input that makes a naive "contains" check return true for
 *   EVERY transaction you have. If that got through, a single rule would
 *   re-categorise your entire history. Find it in the tests.
 *
 * Shape of the solution: clean both strings the same way, reject the trap,
 * then one string method you already know answers the question.
 */
export function ruleMatches(match: string, description: string | null): boolean {
  // TODO(Kilian): implement.
  // Returning false means "no rule ever matches" - the app keeps working
  // exactly as it does today until this is written.
  void match
  void description
  return false
}
