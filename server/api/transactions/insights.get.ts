import { prismaLive } from '~~/server/utils/transactionQuery'
import { requireUserId } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { transferCategoryIds, countsAsFlow } from '~~/server/utils/transfers'
import { loadRules } from '~~/server/utils/merchantRules'
import { transactionLabel } from '~~/shared/utils/merchant'
import { aggregateInsights, insightsWindow, parseDayKey } from '~~/shared/utils/insights'

/**
 * Transactions insights for one week or month: net verdict, subscriptions ring,
 * in-vs-out series, category breakdown. All money is integer cents. Windows are
 * UTC like the dashboard (agreed known limit). Transfers are neither income nor
 * expense - they only show up as `transferredCents`.
 *
 * GET ?period=week|month &anchor=YYYY-MM-DD (any day in the period; default today)
 *     &accountId=<optional, must be the user's own account>
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const q = getQuery(event)

  const kind = q.period
  if (kind !== 'week' && kind !== 'month') {
    throw createError({ statusCode: 400, statusMessage: 'period must be week or month', data: { field: 'period' } })
  }

  // "Today" is the user's calendar day in Brussels; the WINDOWS stay UTC.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(new Date())
  const anchorRaw = typeof q.anchor === 'string' && q.anchor ? q.anchor : today
  const anchor = parseDayKey(anchorRaw)
  if (!anchor) {
    throw createError({ statusCode: 400, statusMessage: 'anchor must be a real date as YYYY-MM-DD', data: { field: 'anchor' } })
  }
  const win = insightsWindow(kind, anchor)

  // Authorize the account filter BEFORE querying with it.
  let accountId: string | null = null
  if (q.accountId !== undefined && q.accountId !== '') {
    if (typeof q.accountId !== 'string') {
      throw createError({ statusCode: 400, statusMessage: 'accountId is invalid', data: { field: 'accountId' } })
    }
    const own = await prisma.account.findFirst({ where: { id: q.accountId, userId }, select: { id: true } })
    if (!own) throw createError({ statusCode: 404, statusMessage: 'Account not found' })
    accountId = own.id
  }

  const [rows, accounts, transfers, rules, cats] = await Promise.all([
    prismaLive.transaction.findMany({
      where: { userId, ...(accountId ? { accountId } : {}), bookedAt: { gte: win.start, lt: win.end } },
      select: { amountCents: true, bookedAt: true, categoryId: true, counterparty: true, description: true },
    }),
    prisma.account.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true } }),
    transferCategoryIds(userId),
    loadRules(userId),
    prisma.category.findMany({
      where: { userId },
      select: { id: true, name: true, icon: true, color: true, isSubscription: true },
    }),
  ])

  const flow = rows.filter((t) => countsAsFlow(t.categoryId, transfers))
  const transferredCents = rows
    .filter((t) => !countsAsFlow(t.categoryId, transfers))
    .reduce((n, t) => n + Math.abs(t.amountCents), 0)

  const agg = aggregateInsights(
    win,
    flow.map((t) => ({
      amountCents: t.amountCents,
      bookedAt: t.bookedAt,
      categoryId: t.categoryId,
      label: transactionLabel(t.counterparty, t.description, rules),
    })),
    cats,
  )

  return {
    period: { kind: win.kind, from: win.from, to: win.to, prevAnchor: win.prevAnchor, nextAnchor: win.nextAnchor },
    totals: { ...agg.totals, transferredCents, count: flow.length },
    subscriptions: agg.subscriptions,
    ring: agg.ring,
    series: agg.series,
    categories: agg.categories,
    accounts,
    accountId,
  }
})
