import { prisma } from './prisma'
import { ruleMatches } from '~~/shared/utils/rules'

export { pickRule } from '~~/shared/utils/rulePick'

export function loadRules(userId: string) {
  return prisma.merchantRule.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Apply a rule's CATEGORY to existing rows - only ones still uncategorised.
 * A category chosen by hand is never overwritten by an automatic one.
 *
 * Matching runs in JavaScript through ruleMatches() rather than as a SQL
 * LIKE, deliberately: SQL would treat the bank's runs of spaces differently
 * from ruleMatches, and the two definitions of "matches" would quietly drift
 * apart. One definition, used everywhere.
 */
export async function applyRuleToExisting(userId: string, match: string, categoryId: string) {
  const candidates = await prisma.transaction.findMany({
    where: { userId, deletedAt: null, categoryId: null },
    select: { id: true, description: true },
  })
  const ids = candidates.filter((t) => ruleMatches(match, t.description)).map((t) => t.id)
  if (!ids.length) return 0

  const res = await prisma.transaction.updateMany({
    // categoryId: null again in the WHERE - if something categorised a row
    // between our read and this write, we still don't overwrite it.
    where: { id: { in: ids }, userId, categoryId: null, deletedAt: null },
    data: { categoryId },
  })
  return res.count
}
