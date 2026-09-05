import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import { prisma } from './prisma'

// Ported from VibraFlow (lib/auth/*), adapted from Next.js `cookies()` to h3's
// event-based cookie helpers.

export const SESSION_COOKIE = 'vibravault_session'

// "Remember me" ticked: stay logged in across browser restarts.
const SESSION_TTL_REMEMBER_MS = 1000 * 60 * 60 * 24 * 30
// Not ticked: a shorter DB lifetime AND a session cookie (no expiry attribute),
// so the browser discards it when it closes.
const SESSION_TTL_SESSION_MS = 1000 * 60 * 60 * 12

// bcrypt cost factor. Higher = slower to compute = harder to brute-force.
const SALT_ROUNDS = 12

/** Hash a plaintext password. bcrypt embeds a random salt in the output, so we
 *  never store or manage salts ourselves. */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

/** Hash a session token before it touches the database.
 *  Plain SHA-256 is enough here: the token is already 32 random bytes, so it
 *  doesn't need the slow salted hashing that human-chosen passwords do. */
function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

/** Create a session: random token to the cookie, only its hash to the DB.
 *
 *  `remember` controls BOTH halves, and both matter:
 *   - the DB row's expiresAt (server-side truth)
 *   - whether the cookie gets an `expires` attribute at all. Without one it is
 *     a "session cookie" and the browser drops it on close, which is what
 *     "don't remember me" actually has to mean. Setting only the DB lifetime
 *     would leave the user logged in after closing the browser.
 */
export async function createSession(
  event: H3Event,
  userId: string,
  remember = true,
): Promise<void> {
  const rawToken = randomBytes(32).toString('hex')

  // The schema deliberately has no default on expiresAt — Prisma's DSL can't
  // express "now + 30 days", so the rule lives here, in exactly one place.
  const ttl = remember ? SESSION_TTL_REMEMBER_MS : SESSION_TTL_SESSION_MS
  const expiresAt = new Date(Date.now() + ttl)

  await prisma.session.create({
    data: { hashedToken: hashToken(rawToken), userId, expiresAt },
  })

  setCookie(event, SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    // Omitted entirely when not remembering -> session cookie.
    ...(remember ? { expires: expiresAt } : {}),
  })
}

/** Read the current session, or null. Only reads the cookie — safe anywhere. */
export async function readSession(event: H3Event): Promise<{ userId: string } | null> {
  const rawToken = getCookie(event, SESSION_COOKIE)
  if (!rawToken) return null

  const session = await prisma.session.findUnique({
    where: { hashedToken: hashToken(rawToken) },
  })
  if (!session) return null

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }

  return { userId: session.userId }
}

/** For protected API routes: the userId, or a 401. */
export async function requireUserId(event: H3Event): Promise<string> {
  const session = await readSession(event)
  if (!session) throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  return session.userId
}

/** Destroy the current session: delete the row and clear the cookie. */
export async function destroySession(event: H3Event): Promise<void> {
  const rawToken = getCookie(event, SESSION_COOKIE)

  if (rawToken) {
    await prisma.session
      .deleteMany({ where: { hashedToken: hashToken(rawToken) } })
      .catch(() => {})
  }

  deleteCookie(event, SESSION_COOKIE, { path: '/' })
}
