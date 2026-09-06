import { prismaLive } from '~~/server/utils/transactionQuery'
import { requireUserId } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

/** Monday-start week index for a date, used to bucket a month into weeks. */
function mondayOf(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dow = (x.getUTCDay() + 6) % 7 // Mon = 0
  x.setUTCDate(x.getUTCDate() - dow)
  return x
}

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

  const [monthRows, balanceAgg] = await Promise.all([
    prismaLive.transaction.findMany({
      where: { userId, bookedAt: { gte: start, lt: end } },
      select: { amountCents: true, bookedAt: true, categoryId: true },
    }),
    // Balance is ALL TIME, not this month - it is the account's position, and
    // it is DERIVED, never stored. One source of truth.
    prismaLive.transaction.aggregate({ where: { userId }, _sum: { amountCents: true } }),
  ])

  const income = monthRows.filter((t) => t.amountCents > 0).reduce((n, t) => n + t.amountCents, 0)
  const expense = monthRows.filter((t) => t.amountCents < 0).reduce((n, t) => n + t.amountCents, 0)

  // ---- Weekly buckets, clipped to the month ------------------------------
  // Kilian is paid WEEKLY but bills are monthly, so the month stays the frame
  // and the weeks inside it must be visible. 4- vs 5-paycheque months then read
  // as a pay-cycle fact instead of erratic spending.
  const weekMap = new Map<string, { income: number; expense: number }>()
  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = mondayOf(d).toISOString().slice(0, 10)
    if (!weekMap.has(key)) weekMap.set(key, { income: 0, expense: 0 })
  }
  for (const t of monthRows) {
    const key = mondayOf(t.bookedAt).toISOString().slice(0, 10)
    const b = weekMap.get(key)
    if (!b) continue
    if (t.amountCents > 0) b.income += t.amountCents
    else b.expense += t.amountCents
  }

  const weeks = [...weekMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([weekStart, v]) => {
      const s = new Date(weekStart)
      const e = new Date(s); e.setUTCDate(e.getUTCDate() + 6)
      // Clip the label to the month so a week straddling a boundary reads honestly.
      const from = s < start ? start : s
      const to = e >= end ? new Date(end.getTime() - 86400000) : e
      return {
        weekStart,
        label: `${from.getUTCDate()}–${to.getUTCDate()}`,
        income: v.income,
        expense: v.expense,
      }
    })

  // ---- Top spending categories this month --------------------------------
  const cats = await prisma.category.findMany({ where: { userId } })
  const byCat = new Map<string, number>()
  for (const t of monthRows) {
    if (t.amountCents >= 0) continue
    const key = t.categoryId ?? ''
    byCat.set(key, (byCat.get(key) ?? 0) + t.amountCents)
  }
  const topCategories = [...byCat.entries()]
    .map(([id, total]) => {
      const c = cats.find((x) => x.id === id)
      return {
        id: id || null,
        name: c?.name ?? 'Uncategorised',
        icon: c?.icon ?? '·',
        color: c?.color ?? null,
        total,
      }
    })
    .sort((a, b) => a.total - b.total) // most negative first
    .slice(0, 5)

  return {
    month,
    balanceCents: balanceAgg._sum.amountCents ?? 0,
    totals: { income, expense, net: income + expense, count: monthRows.length },
    weeks,
    topCategories,
    uncategorised: monthRows.filter((t) => !t.categoryId).length,
  }
})
