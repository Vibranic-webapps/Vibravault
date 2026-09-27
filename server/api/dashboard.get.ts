import { prismaLive } from '~~/server/utils/transactionQuery'
import { requireUserId } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { transferCategoryIds, countsAsFlow } from '~~/server/utils/transfers'
import { loadRules } from '~~/server/utils/merchantRules'
import { transactionLabel } from '~~/shared/utils/merchant'

/** Monday-start week index for a date, used to bucket a month into weeks. */
function mondayOf(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dow = (x.getUTCDay() + 6) % 7 // Mon = 0
  x.setUTCDate(x.getUTCDate() - dow)
  return x
}

const LATEST_COUNT = 5

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const q = getQuery(event)

  const now = new Date()
  const month = typeof q.month === 'string' && /^\d{4}-\d{2}$/.test(q.month)
    ? q.month
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [y, m] = month.split('-').map(Number)
  const start = new Date(Date.UTC(y!, m! - 1, 1))
  const end = new Date(Date.UTC(y!, m!, 1))

  const [monthRows, perAccount, accounts, totalEver, transfers, rules, cats] = await Promise.all([
    prismaLive.transaction.findMany({
      where: { userId, bookedAt: { gte: start, lt: end } },
      orderBy: [{ bookedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true, amountCents: true, bookedAt: true, categoryId: true,
        counterparty: true, counterpartyIban: true, description: true,
        balanceAfterCents: true, source: true,
      },
    }),
    // Balance is ALL TIME, not this month - it is the account's position, and
    // it is DERIVED, never stored. One source of truth. Per account, because
    // each bank gets its own card on Home.
    prismaLive.transaction.groupBy({
      by: ['accountId'],
      where: { userId },
      _sum: { amountCents: true },
      _max: { bookedAt: true },
    }),
    prisma.account.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true } }),
    prismaLive.transaction.count({ where: { userId } }),
    transferCategoryIds(userId),
    loadRules(userId),
    prisma.category.findMany({ where: { userId } }),
  ])

  // Readable name for a row - the same four layers the transaction list uses.
  const labelOf = (t: { counterparty: string | null; description: string | null }) =>
    transactionLabel(t.counterparty, t.description, rules)

  // ---- Bank cards ---------------------------------------------------------
  const sums = new Map(perAccount.map((a) => [a.accountId, a]))
  const accountCards = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    balanceCents: sums.get(a.id)?._sum.amountCents ?? 0,
    lastBookedAt: sums.get(a.id)?._max.bookedAt ?? null,
  }))
  const balanceCents = accountCards.reduce((n, a) => n + a.balanceCents, 0)

  // Balance above keeps EVERY row. Everything below that means "income" or
  // "spending" drops transfers between the user's own accounts.
  const flowRows = monthRows.filter((t) => countsAsFlow(t.categoryId, transfers))

  const income = flowRows.filter((t) => t.amountCents > 0).reduce((n, t) => n + t.amountCents, 0)
  const expense = flowRows.filter((t) => t.amountCents < 0).reduce((n, t) => n + t.amountCents, 0)

  // ---- Weekly buckets, clipped to the month ------------------------------
  // Kilian is paid WEEKLY but bills are monthly, so the month stays the frame
  // and the weeks inside it must be visible. 4- vs 5-paycheque months then read
  // as a pay-cycle fact instead of erratic spending.
  interface Bucket {
    income: number
    expense: number
    count: number
    biggest: { label: string; amountCents: number } | null
  }
  const weekMap = new Map<string, Bucket>()
  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = mondayOf(d).toISOString().slice(0, 10)
    if (!weekMap.has(key)) weekMap.set(key, { income: 0, expense: 0, count: 0, biggest: null })
  }
  for (const t of flowRows) {
    const b = weekMap.get(mondayOf(t.bookedAt).toISOString().slice(0, 10))
    if (!b) continue
    b.count += 1
    if (t.amountCents > 0) {
      b.income += t.amountCents
    } else {
      b.expense += t.amountCents
      // Biggest single spend of the week - what the tap detail calls out.
      if (!b.biggest || t.amountCents < b.biggest.amountCents) {
        b.biggest = { label: labelOf(t), amountCents: t.amountCents }
      }
    }
  }

  const weeks = [...weekMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([weekStart, v]) => {
      const s = new Date(weekStart)
      const e = new Date(s); e.setUTCDate(e.getUTCDate() + 6)
      // Clip to the month so a week straddling a boundary reads honestly.
      const from = s < start ? start : s
      const to = e >= end ? new Date(end.getTime() - 86400000) : e
      return {
        weekStart,
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
        label: `${from.getUTCDate()}–${to.getUTCDate()}`,
        ...v,
      }
    })

  // ---- Top spending categories this month --------------------------------
  const byCat = new Map<string, number>()
  for (const t of flowRows) {
    if (t.amountCents >= 0) continue
    const key = t.categoryId ?? ''
    byCat.set(key, (byCat.get(key) ?? 0) + t.amountCents)
  }
  const topCategories = [...byCat.entries()]
    .map(([id, total]) => {
      const c = cats.find((x) => x.id === id)
      return {
        id: id || null, // null = uncategorised; the client names it in the app language
        name: c?.name ?? null,
        icon: c?.icon ?? null,
        color: c?.color ?? null,
        total,
      }
    })
    .sort((a, b) => a.total - b.total) // most negative first
    .slice(0, 5)

  // ---- Latest this month --------------------------------------------------
  // Full rows (not just labels) so Home can open the same drawer as the list.
  const latest = monthRows.slice(0, LATEST_COUNT).map((t) => ({
    ...t,
    bookedAt: t.bookedAt.toISOString(),
    label: labelOf(t),
  }))

  return {
    month,
    balanceCents,
    accounts: accountCards,
    totals: { income, expense, net: income + expense, count: monthRows.length },
    weeks,
    topCategories,
    latest,
    uncategorised: monthRows.filter((t) => !t.categoryId).length,
    hasAnyTransactions: totalEver > 0,
  }
})
