import { prisma } from './prisma'

/**
 * Everything a brand-new user needs to have a usable app on first login.
 *
 * A finance app's first run is otherwise all empty states: no account to
 * attach transactions to, and no categories to file them under. Seeding here
 * means the CSV importer has somewhere to put rows from the very first import.
 */

// The invisible v1 account. The Account table exists in the schema so that
// meal vouchers can become account #2 later without a migration, but v1 shows
// no account UI at all - this single row is simply assumed everywhere.
const DEFAULT_ACCOUNT = { name: 'Bank', type: 'BANK', currency: 'EUR' } as const

// `color` stores a TOKEN NAME, not a hex value. The UI resolves it to
// var(--vv-cat-N), which means categories automatically get the right tint in
// both light and dark mode - a stored hex could only ever be right in one.
const DEFAULT_CATEGORIES = [
  // Income. "Holiday pay" and "Year-end premium" exist from day one because
  // Kilian is interim (Accent): those arrive from third parties (RJV /
  // Sociaal Fonds), not the employer, and must not pollute weekly wage averages.
  { name: 'Wage',              kind: 'INCOME',  icon: '💼', color: 'cat-5' },
  { name: 'Holiday pay',       kind: 'INCOME',  icon: '🌴', color: 'cat-4' },
  { name: 'Year-end premium',  kind: 'INCOME',  icon: '🎁', color: 'cat-3' },
  { name: 'Other income',      kind: 'INCOME',  icon: '💰', color: 'cat-2' },

  // Expenses.
  { name: 'Groceries',         kind: 'EXPENSE', icon: '🛒', color: 'cat-1' },
  { name: 'Housing',           kind: 'EXPENSE', icon: '🏠', color: 'cat-7' },
  { name: 'Utilities',         kind: 'EXPENSE', icon: '💡', color: 'cat-6' },
  { name: 'Transport',         kind: 'EXPENSE', icon: '🚲', color: 'cat-8' },
  { name: 'Subscriptions',     kind: 'EXPENSE', icon: '📺', color: 'cat-9' },
  { name: 'Eating out',        kind: 'EXPENSE', icon: '🍽️', color: 'cat-12' },
  { name: 'Shopping',          kind: 'EXPENSE', icon: '🛍️', color: 'cat-10' },
  { name: 'Health',            kind: 'EXPENSE', icon: '💊', color: 'cat-11' },
  { name: 'Other expense',     kind: 'EXPENSE', icon: '📦', color: 'cat-2' },
] as const

/**
 * Idempotent. Safe to call on every signup AND as a repair for users created
 * before seeding existed (there are already such users in dev and production,
 * and production credentials are not reachable from a dev machine - so this
 * self-heals instead of needing a manual migration script per environment).
 *
 * Account and categories are checked independently: a user can legitimately
 * have one and not the other if an earlier attempt failed partway.
 */
export async function ensureUserSeeded(userId: string) {
  const [accountCount, categoryCount] = await Promise.all([
    prisma.account.count({ where: { userId } }),
    prisma.category.count({ where: { userId } }),
  ])

  if (accountCount === 0) {
    await prisma.account.create({ data: { userId, ...DEFAULT_ACCOUNT } })
  }

  if (categoryCount === 0) {
    // skipDuplicates guards the @@unique([userId, name]) constraint if this
    // ever races with itself.
    await prisma.category.createMany({
      data: DEFAULT_CATEGORIES.map((c) => ({ userId, ...c })),
      skipDuplicates: true,
    })
  }
}

/**
 * The single v1 account. Every transaction attaches to it.
 *
 * Centralised so that when account #2 (meal vouchers) arrives there is ONE
 * place assuming "the account", rather than a scatter of lookups to hunt down.
 * Self-heals a missing account rather than throwing.
 */
export async function getDefaultAccountId(userId: string): Promise<string> {
  const existing = await prisma.account.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (existing) return existing.id

  await ensureUserSeeded(userId)

  const created = await prisma.account.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (!created) throw createError({ statusCode: 500, statusMessage: 'Could not create an account' })
  return created.id
}
