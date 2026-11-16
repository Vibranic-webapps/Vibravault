import { Check, Clock, TriangleAlert, SkipForward, CalendarDays, Pause } from 'lucide-vue-next'
import type { Component } from 'vue'
import type { Occ, OccState, RecurringCadence, RecurringDirection } from '~/stores/recurring'

/**
 * Words, icons and amounts for recurring rows, shared by the row, the detail
 * sheet and the pages, so a state is never described two different ways.
 * Every state gets BOTH an icon and words (colour is never the only signal).
 */

/** What a row can show: a real occurrence state, or "paused" (no open occurrence). */
export type RowState = OccState | 'paused'

export const STATE_ICON: Record<RowState, Component> = {
  paid: Check,
  markedPaid: Check,
  skipped: SkipForward,
  overdue: TriangleAlert,
  dueSoon: Clock,
  upcoming: CalendarDays,
  paused: Pause,
}

/** Cadence order for the pickers. Labels live in i18n (recurring.cadence.*). */
export const CADENCE_OPTIONS: RecurringCadence[] = ['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']

export const isOpen = (s: RowState) => s === 'overdue' || s === 'dueSoon' || s === 'upcoming'
export const isSettled = (s: RowState) => s === 'paid' || s === 'markedPaid' || s === 'skipped'

/** "YYYY-MM-DD" -> a LOCAL date (new Date('YYYY-MM-DD') is UTC and can land on the day before). */
export function dayToDate(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

export function useRecurringText() {
  const { t } = useI18n()
  const { money, date } = useFormat()

  /** Short day + month for the date stone: { day: '14', month: 'nov' }. */
  function stone(dueOn: string | null) {
    if (!dueOn) return { day: '–', month: '' }
    const d = dayToDate(dueOn)
    return { day: String(d.getDate()), month: date(d, { month: 'short' }).replace('.', '') }
  }

  const shortDate = (day: string) => date(dayToDate(day), { day: 'numeric', month: 'short' })
  const longDate = (day: string) => date(dayToDate(day), { weekday: 'long', day: 'numeric', month: 'long' })

  /** The state in words: "4 days late", "In 9 days", "Paid 14 Nov", "Skipped". */
  function stateText(state: RowState, direction: RecurringDirection, occ: Pick<Occ, 'daysUntil' | 'paidOn' | 'dueOn'> | null): string {
    const days = occ?.daysUntil ?? 0
    switch (state) {
      case 'overdue':
        return direction === 'IN' ? t('recurring.state.overdueIn', -days) : t('recurring.state.overdueOut', -days)
      case 'dueSoon':
        return days <= 0 ? t('recurring.state.today') : days === 1 ? t('recurring.state.tomorrow') : t('recurring.state.inDays', { n: days })
      case 'upcoming':
        return t('recurring.state.inDays', { n: days })
      case 'paid':
      case 'markedPaid': {
        const when = shortDate(occ?.paidOn ?? occ?.dueOn ?? '')
        return direction === 'IN' ? t('recurring.state.received', { date: when }) : t('recurring.state.paid', { date: when })
      }
      case 'skipped':
        return t('recurring.state.skipped')
      default:
        return t('recurring.state.paused')
    }
  }

  /** Signed amount for a row. A range shows "~" and its middle; the exact range is in the detail sheet. */
  function amountText(minCents: number, maxCents: number, direction: RecurringDirection): string {
    const varies = minCents !== maxCents
    const cents = varies ? Math.round((minCents + maxCents) / 2) : minCents
    const text = direction === 'IN' ? money(cents, { signed: true }) : money(-cents)
    return varies ? `${t('recurring.approx')}${text}` : text
  }

  const cadenceShort = (c: RecurringCadence) => t(`recurring.cadenceShort.${c}`)
  const cadenceName = (c: RecurringCadence) => t(`recurring.cadence.${c}`)
  const kindWord = (d: RecurringDirection) => (d === 'IN' ? t('recurring.kindIn') : t('recurring.kindOut'))

  return { stone, shortDate, longDate, stateText, amountText, cadenceShort, cadenceName, kindWord, money }
}
