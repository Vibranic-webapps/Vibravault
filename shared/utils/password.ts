// Single source of truth for password rules.
//
// Imported by BOTH the signup page (to draw the checklist) and the signup API
// route (to enforce them). The client copy is for the user's benefit; the
// server copy is the one that actually matters, since anyone can POST straight
// to the endpoint and skip the UI entirely.

export interface PasswordRule {
  id: string
  label: string
  test: (value: string) => boolean
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', label: 'More than 8 characters', test: (v) => v.length > 8 },
  { id: 'lower',  label: 'A lower-case letter',    test: (v) => /[a-z]/.test(v) },
  { id: 'upper',  label: 'An upper-case letter',   test: (v) => /[A-Z]/.test(v) },
  { id: 'number', label: 'A number',               test: (v) => /[0-9]/.test(v) },
]

/** Which rules a password satisfies. */
export function passwordRuleResults(value: string) {
  return PASSWORD_RULES.map((rule) => ({ ...rule, passed: rule.test(value) }))
}

/** How many rules are met: 0-4. Drives the strength bar. */
export function passwordScore(value: string): number {
  if (!value) return 0
  return PASSWORD_RULES.reduce((n, rule) => n + (rule.test(value) ? 1 : 0), 0)
}

export function isPasswordValid(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(value))
}

/** Human-readable list of what's still missing — used for the API error. */
export function passwordProblems(value: string): string[] {
  return PASSWORD_RULES.filter((rule) => !rule.test(value)).map((r) => r.label.toLowerCase())
}

export const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'] as const
