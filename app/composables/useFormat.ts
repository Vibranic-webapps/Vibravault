import { formatCents } from '~~/shared/utils/money'

/**
 * Money and dates in the CURRENT app language.
 *
 *   money(-123456)   nl -> "−€ 1.234,56"   en -> "−€1,234.56"
 *   date('2026-09-24', { day: 'numeric', month: 'short' })
 *                    nl -> "24 sep."       en -> "24 Sept"
 *
 * Components use this instead of calling formatCents / toLocaleDateString
 * directly, so switching language re-formats every number on the screen.
 */
export function useFormat() {
  const { locale } = useI18n()
  const tag = computed(() => (locale.value === 'nl' ? 'nl-BE' : 'en-GB'))

  function money(cents: number, opts: { signed?: boolean } = {}) {
    return formatCents(cents, { ...opts, locale: tag.value })
  }

  function date(value: string | Date, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) {
    return new Date(value).toLocaleDateString(tag.value, opts)
  }

  function monthName(key: string) {
    const [y, m] = key.split('-').map(Number)
    return new Date(y!, m! - 1, 1).toLocaleDateString(tag.value, { month: 'long', year: 'numeric' })
  }

  return { money, date, monthName, localeTag: tag }
}
