import { prisma } from '~~/server/utils/prisma'
import { readSession } from '~~/server/utils/auth'

// Returns the current user, or null. Deliberately NOT a 401: route middleware
// asks "who am I?" on every navigation, and "nobody" is a normal answer.
export default defineEventHandler(async (event) => {
  const session = await readSession(event)
  if (!session) return null

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true },
  })

  return user
})
