import { createHash, randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import { prisma } from './prisma'

/**
 * Credentials for the iOS Shortcut that shares a CSV into the app.
 *
 * Same discipline as sessions: the Shortcut holds the raw token, the database
 * holds only its SHA-256 hash. Plain SHA-256 is right here - the token is
 * already 32 random bytes, so it does not need the slow salted hashing that
 * human-chosen passwords require.
 */
const PREFIX = 'vv_'

function hash(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

/** Returns the RAW token - the only moment it exists in readable form. */
export async function createImportToken(userId: string, name: string) {
  const raw = PREFIX + randomBytes(32).toString('hex')
  const token = await prisma.importToken.create({
    data: { userId, name, hashedToken: hash(raw) },
    select: { id: true, name: true, createdAt: true },
  })
  return { ...token, raw }
}

/**
 * Authenticate a Shortcut request. Returns the userId, or throws 401.
 * Revoked tokens are kept but rejected, so the audit trail survives.
 */
export async function requireImportToken(event: H3Event): Promise<string> {
  const header = getHeader(event, 'x-import-token')
    ?? getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '')

  if (!header?.startsWith(PREFIX)) {
    throw createError({ statusCode: 401, statusMessage: 'Missing or malformed import token' })
  }

  const token = await prisma.importToken.findUnique({
    where: { hashedToken: hash(header) },
    select: { id: true, userId: true, revokedAt: true },
  })

  if (!token || token.revokedAt) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid or revoked import token' })
  }

  // Fire-and-forget: a "last used" timestamp must never slow or fail an import.
  prisma.importToken
    .update({ where: { id: token.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {})

  return token.userId
}
