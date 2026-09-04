// TEMPORARY diagnostic endpoint — delete once production auth works.
// Deliberately reports only presence/shape of config, never credentials.
import { prisma } from '~~/server/utils/prisma'

function describe(raw: string | undefined) {
  if (!raw) return { set: false }
  try {
    const u = new URL(raw)
    return {
      set: true,
      host: u.hostname,                       // safe: no user/password
      pooled: u.hostname.includes('-pooler'),
      database: u.pathname.replace('/', ''),
      hasSslMode: u.searchParams.has('sslmode'),
    }
  } catch {
    return { set: true, parseable: false, length: raw.length }
  }
}

export default defineEventHandler(async () => {
  const result: Record<string, unknown> = {
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    DATABASE_URL: describe(process.env.DATABASE_URL),
    DIRECT_URL: describe(process.env.DIRECT_URL),
  }

  try {
    await prisma.$queryRawUnsafe('SELECT 1')
    result.dbQuery = 'ok'
    result.userCount = await prisma.user.count()
  } catch (e: any) {
    // The actual reason, which Nitro hides behind a generic 500.
    result.dbQuery = 'FAILED'
    result.errorName = e?.name ?? null
    result.errorCode = e?.errorCode ?? e?.code ?? null
    result.errorMessage = String(e?.message ?? e).slice(0, 900)
  }

  return result
})
