import { prisma } from '~~/server/utils/prisma'
import { requireUserId, verifyPassword, hashPassword, createSession } from '~~/server/utils/auth'
import { isPasswordValid, passwordProblems } from '~~/shared/utils/password'

/**
 * Change your password while signed in.
 *
 * - The CURRENT password is required: a session left open on someone else's
 *   screen must not be enough to take over the account.
 * - Same rules as signup / reset, from the same shared module.
 * - Every session is ended (then this device signs straight back in): if a
 *   stolen session exists anywhere, changing the password must evict it.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const { current, next } = await readBody<{ current?: unknown; next?: unknown }>(event)

  if (typeof current !== 'string' || typeof next !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Current and new password are required' })
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } })
  if (!user || !(await verifyPassword(current, user.passwordHash))) {
    // 403, not 401: you ARE signed in - the password you typed is just wrong.
    throw createError({ statusCode: 403, statusMessage: 'Current password is not right' })
  }

  if (!isPasswordValid(next)) {
    throw createError({ statusCode: 400, statusMessage: `Password needs ${passwordProblems(next).join(', ')}` })
  }

  const passwordHash = await hashPassword(next)
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.session.deleteMany({ where: { userId } }),
    // Outstanding "forgot password" links would still work on the OLD
    // account state - they die with the change.
    prisma.passwordResetToken.deleteMany({ where: { userId, usedAt: null } }),
  ])

  await createSession(event, userId, true)
  return { ok: true }
})
