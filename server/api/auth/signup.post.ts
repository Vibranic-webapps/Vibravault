import { prisma } from '~~/server/utils/prisma'
import { hashPassword, createSession } from '~~/server/utils/auth'
import { isPasswordValid, passwordProblems } from '~~/shared/utils/password'

export default defineEventHandler(async (event) => {
  const { email, password } = await readBody<{ email?: unknown; password?: unknown }>(event)

  if (typeof email !== 'string' || typeof password !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Email and password are required' })
  }

  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail.includes('@')) {
    throw createError({ statusCode: 400, statusMessage: 'Enter a valid email' })
  }

  // Enforced here, not just in the UI: the page's checklist is a courtesy,
  // this is the rule. Same module both sides, so they can never drift.
  if (!isPasswordValid(password)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Password needs ${passwordProblems(password).join(', ')}`,
    })
  }

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'An account with that email already exists' })
  }

  const passwordHash = await hashPassword(password)
  const user = await prisma.user.create({ data: { email: normalizedEmail, passwordHash } })

  await createSession(event, user.id)

  setResponseStatus(event, 201)
  return { id: user.id, email: user.email }
})
