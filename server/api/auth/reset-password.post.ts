import { createHash } from 'node:crypto'
import { prisma } from '~~/server/utils/prisma'
import { hashPassword, createSession } from '~~/server/utils/auth'
import { isPasswordValid, passwordProblems } from '~~/shared/utils/password'

export default defineEventHandler(async (event) => {
  const { token, password } = await readBody<{ token?: unknown; password?: unknown }>(event)

  if (typeof token !== 'string' || typeof password !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Token and password are required' })
  }

  // Same rules as signup, from the same shared module.
  if (!isPasswordValid(password)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Password needs ${passwordProblems(password).join(', ')}`,
    })
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { hashedToken: createHash('sha256').update(token).digest('hex') },
  })

  const invalid = !record || record.usedAt !== null || record.expiresAt < new Date()
  if (invalid) {
    throw createError({ statusCode: 400, statusMessage: 'This reset link is invalid or has expired' })
  }

  const passwordHash = await hashPassword(password)

  await prisma.$transaction([
    prisma.user.update({ where: { id: record!.userId }, data: { passwordHash } }),
    // Single use.
    prisma.passwordResetToken.update({ where: { id: record!.id }, data: { usedAt: new Date() } }),
    // Any other outstanding reset links die too.
    prisma.passwordResetToken.deleteMany({ where: { userId: record!.userId, usedAt: null } }),
    // Log out everywhere: if someone else had a stolen session, changing the
    // password must actually evict them.
    prisma.session.deleteMany({ where: { userId: record!.userId } }),
  ])

  // Log the user straight in on their new password.
  await createSession(event, record!.userId, true)

  return { ok: true }
})
