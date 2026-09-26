import { prisma } from '~~/server/utils/prisma'
import { requireUserId } from '~~/server/utils/auth'
import { applyRuleToExisting } from '~~/server/utils/merchantRules'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = await readBody<{
    match?: unknown; label?: unknown; categoryId?: unknown; applyToExisting?: unknown
  }>(event)

  const match = typeof body?.match === 'string' ? body.match.replace(/\s+/g, ' ').trim() : ''
  // The server enforces the trap too - not just ruleMatches. A rule that
  // matches everything must be impossible to CREATE, not merely harmless.
  if (match.length < 3) {
    throw createError({ statusCode: 400, statusMessage: 'Match text must be at least 3 characters' })
  }
  if (match.length > 80) {
    throw createError({ statusCode: 400, statusMessage: 'Match text is too long' })
  }

  const label = typeof body?.label === 'string' && body.label.trim() ? body.label.trim().slice(0, 40) : null
  const categoryId = typeof body?.categoryId === 'string' && body.categoryId ? body.categoryId : null

  if (!label && !categoryId) {
    throw createError({ statusCode: 400, statusMessage: 'A rule needs a name, a category, or both' })
  }
  if (categoryId) {
    const owned = await prisma.category.findFirst({ where: { id: categoryId, userId } })
    if (!owned) throw createError({ statusCode: 400, statusMessage: 'Unknown category' })
  }

  const rule = await prisma.merchantRule.create({ data: { userId, match, label, categoryId } })

  const categorised = categoryId && body?.applyToExisting !== false
    ? await applyRuleToExisting(userId, match, categoryId)
    : 0

  setResponseStatus(event, 201)
  return { rule, categorised }
})
