import { prisma } from '~~/server/utils/prisma'
import { requireUserId } from '~~/server/utils/auth'
import { parseDayKey } from '~~/shared/utils/insights'
import { dueDates, type SettlementKind } from '~~/shared/utils/recurring'
import { findOwnedItem, recurringError, recurringNotFound, viewItem } from '~~/server/utils/recurring'

/**
 * Settle ONE due date by hand: { dueOn: 'YYYY-MM-DD', kind: 'SKIPPED' | 'MARKED_PAID' }.
 * "Skip this time" for a bill, "Mark paid" for a bill, "Received" for income.
 * Idempotent: repeating it (double tap, retry) leaves one record; sending the
 * other kind switches it. Undo = DELETE /api/recurring/[id]/settle?dueOn=...
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{ dueOn?: unknown; kind?: unknown }>(event)

  const dueOn = parseDayKey(body?.dueOn)
  if (!dueOn) throw recurringError(400, 'dueOn must be a real date as YYYY-MM-DD', 'RECURRING_DUE_INVALID', 'dueOn')
  const kind = body?.kind
  if (kind !== 'SKIPPED' && kind !== 'MARKED_PAID') {
    throw recurringError(400, 'kind must be SKIPPED or MARKED_PAID', 'RECURRING_KIND_INVALID', 'kind')
  }

  const item = await findOwnedItem(userId, id)
  if (!item) throw recurringNotFound()

  // Only a real due date of this item can be settled (not any random day).
  const day = body!.dueOn as string
  if (!dueDates(item, day, day).length) {
    throw recurringError(400, 'That date is not a due date of this item', 'RECURRING_DUE_NOT_A_DUE_DATE', 'dueOn')
  }

  const settlementKind = kind as SettlementKind
  try {
    await prisma.recurringSettlement.upsert({
      where: { recurringItemId_dueOn: { recurringItemId: id, dueOn } },
      create: { userId, recurringItemId: id, dueOn, kind: settlementKind },
      update: { kind: settlementKind },
    })
  } catch (e: any) {
    // Two taps raced past the existence check: the row exists now, so just set the kind.
    if (e?.code !== 'P2002') throw e
    await prisma.recurringSettlement.updateMany({ where: { recurringItemId: id, userId, dueOn }, data: { kind: settlementKind } })
  }

  return viewItem(userId, item)
})
