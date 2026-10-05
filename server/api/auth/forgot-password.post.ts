import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '~~/server/utils/prisma'
import { sendMail, resetEmail } from '~~/server/utils/mail'
import { isDemoEmail } from '~~/server/utils/demo'

const RESET_TTL_MS = 1000 * 60 * 60 // 1 hour

export default defineEventHandler(async (event) => {
  const { email } = await readBody<{ email?: unknown }>(event)
  if (typeof email !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Email is required' })
  }

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })

  // Only do work if the account exists - but ALWAYS return the same response.
  // Answering differently for known vs unknown addresses turns this endpoint
  // into a way to enumerate who has an account.
  // The shared demo account gets no reset link: it answers exactly like an
  // unknown address does.
  if (user && !isDemoEmail(user.email)) {
    const rawToken = randomBytes(32).toString('hex')

    // Same pattern as sessions: the link carries the raw token, the DB stores
    // only its hash, so a database leak yields no usable reset links.
    await prisma.passwordResetToken.create({
      data: {
        hashedToken: createHash('sha256').update(rawToken).digest('hex'),
        userId: user.id,
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
      },
    })

    const base = process.env.NUXT_PUBLIC_SITE_URL ?? getRequestURL(event).origin
    const { subject, text, html } = resetEmail(`${base}/reset-password?token=${rawToken}`)
    await sendMail({ to: user.email, subject, text, html })
  }

  return { ok: true }
})
