import { ruleMatches } from './rules'

export interface RuleLike {
  id: string
  match: string
  label: string | null
  categoryId: string | null
  createdAt: Date | string
}

/**
 * When several rules match one transaction, the MOST SPECIFIC wins: the one
 * with the longest match text. A rule for "APPLE SERVICES" beats a broader
 * rule for "APPLE" on the same row. Ties go to the newest rule - the latest
 * thing the user taught is assumed to be what they want now.
 *
 * Shared by server (imports, retro-apply) and client (labels), so "which rule
 * wins" can never differ between what you see and what gets stored.
 * Matching itself is ruleMatches() - one definition, used everywhere.
 */
export function pickRule<T extends RuleLike>(rules: T[], description: string | null): T | null {
  let best: T | null = null
  for (const r of rules) {
    if (!ruleMatches(r.match, description)) continue
    if (
      !best
      || r.match.length > best.match.length
      || (r.match.length === best.match.length && new Date(r.createdAt) > new Date(best.createdAt))
    ) best = r
  }
  return best
}
