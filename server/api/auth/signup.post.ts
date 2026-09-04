import { prisma } from '~~/server/utils/prisma'
import { hashPassword, createSession } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const { email, password } = await readBody<{ email?: unknown; password?: unknown }>(event)

  if (typeof email !== 'string' || typeof password !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Email and password are required' })
  }

  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail.includes('@')) {
    throw createError({ statusCode: 400, statusMessage: 'Enter a valid email' })
  }
  if (password.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'Password must be at least 8 characters' })
  }

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'An account with that email already exists' })
  }

  const passwordHash = await hashPassword(password)
  const user = await prisma.user.create({ data: { email: normalizedEmail, passwordHash } })

  // Log them in right away.
  await createSession(event, user.id)

  setResponseStatus(event, 201)
  return { id: user.id, email: user.email }
})
