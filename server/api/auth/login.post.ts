import { prisma } from '~~/server/utils/prisma'
import { verifyPassword, createSession } from '~~/server/utils/auth'
import { reportEvent } from '~~/server/utils/vibradex'

export default defineEventHandler(async (event) => {
  const { email, password, remember } = await readBody<{
    email?: unknown; password?: unknown; remember?: unknown
  }>(event)

  if (typeof email !== 'string' || typeof password !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Email and password are required' })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })

  // Same generic error whether the email is unknown or the password is wrong,
  // so the endpoint never reveals which emails are registered.
  const passwordOk = user ? await verifyPassword(password, user.passwordHash) : false
  if (!user || !passwordOk) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  }

  await createSession(event, user.id, remember !== false)

  event.waitUntil?.(reportEvent('User logged in', { details: { userId: user.id } }))

  return { id: user.id, email: user.email }
})
