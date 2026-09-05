import { prisma } from '~~/server/utils/prisma'
import { readSession } from '~~/server/utils/auth'
import { ensureUserSeeded } from '~~/server/utils/seed'

// Returns the current user, or null. Deliberately NOT a 401: route middleware
// asks "who am I?" on every navigation, and "nobody" is a normal answer.
export default defineEventHandler(async (event) => {
  const session = await readSession(event)
  if (!session) return null

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true },
  })
  if (!user) return null

  // Repair users created before seeding existed. Idempotent and cheap (two
  // COUNTs); it does real work at most once per user, ever.
  await ensureUserSeeded(user.id)

  return user
})
