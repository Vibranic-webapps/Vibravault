import { DEMO_REFUSAL } from '~~/shared/utils/demo'

// The shared DEMO account. Its login is public (printed on Kilian's CV), so
// every visitor signs in as the same user. They may use the whole app, but
// nothing that would let one visitor take the account over or lock the next
// one out: no password change, no reset, no profile edits.
//
// This file is the ONE place that decides "is this the demo account".

/** Used when DEMO_EMAILS is not set at all, so production is protected even
 *  before the env var exists. Set DEMO_EMAILS="" to have no demo account. */
const DEFAULT_DEMO_EMAILS = 'demo@kilianfrederix.net'

/** Read per call (it's a cheap split) so a changed env var needs no code path
 *  other than a redeploy/restart. */
function demoEmails(): string[] {
  const raw = process.env.DEMO_EMAILS ?? DEFAULT_DEMO_EMAILS
  return raw
    .split(',')
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isDemoEmail(email: string): boolean {
  return demoEmails().includes(email.trim().toLowerCase())
}

/** 403 for the demo account, no-op for everyone else. */
export function refuseIfDemo(email: string): void {
  if (isDemoEmail(email)) {
    throw createError({ statusCode: 403, statusMessage: DEMO_REFUSAL })
  }
}

/** The user shape every auth endpoint returns (matches AuthUser in
 *  app/composables/useAuthUser.ts), so the app can show a demo notice. */
export function toAuthUser(user: { id: string; email: string; name: string | null }) {
  return { id: user.id, email: user.email, name: user.name, demo: isDemoEmail(user.email) }
}
