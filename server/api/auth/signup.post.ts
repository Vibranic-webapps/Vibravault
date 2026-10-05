import { prisma } from '~~/server/utils/prisma'
import { hashPassword, createSession } from '~~/server/utils/auth'
import { ensureUserSeeded } from '~~/server/utils/seed'
import { reportEvent } from '~~/server/utils/vibradex'
import { refuseIfDemo, toAuthUser } from '~~/server/utils/demo'
import { isPasswordValid, passwordProblems } from '~~/shared/utils/password'

export default defineEventHandler(async (event) => {
  const { email, password, name } = await readBody<{ email?: unknown; password?: unknown; name?: unknown }>(event)

  if (typeof email !== 'string' || typeof password !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Email and password are required' })
  }

  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail.includes('@')) {
    throw createError({ statusCode: 400, statusMessage: 'Enter a valid email' })
  }

  // Nobody may register a demo address with a password of their own: the demo
  // account would be theirs, and locked. To (re)create or repair the demo
  // user, use a one-off script - never empty DEMO_EMAILS on production.
  refuseIfDemo(normalizedEmail)

  // Enforced here, not just in the UI: the page's checklist is a courtesy,
  // this is the rule. Same module both sides, so they can never drift.
  if (!isPasswordValid(password)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Password needs ${passwordProblems(password).join(', ')}`,
    })
  }

  // Optional: what Home greets you with ("Hey Kilian"). Same rules as
  // PATCH /api/auth/me - whitespace collapsed, max 40, empty = none.
  const cleanName = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, 40) : ''

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'An account with that email already exists' })
  }

  const passwordHash = await hashPassword(password)
  const user = await prisma.user.create({ data: { email: normalizedEmail, passwordHash, name: cleanName || null } })

  // Give them a usable app immediately: the invisible v1 account + categories.
  await ensureUserSeeded(user.id)

  await createSession(event, user.id)

  event.waitUntil?.(reportEvent('New user signed up', { details: { userId: user.id } }))

  setResponseStatus(event, 201)
  return toAuthUser(user)
})
