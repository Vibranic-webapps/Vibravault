/**
 * Money for tight spots (stat tiles, the ring's centre): like formatCents, but
 * from 1.000 euro up the cents are dropped ("€ 12.346" instead of "€ 12.345,67"),
 * so the number stays short. Display only: the exact figure is always available
 * elsewhere as text. Integer cents in; the rounding is done on integers.
 */
const WHOLE_EURO_FROM_CENTS = 100_000

export function moneyCompact(cents: number, locale: string, opts: { signed?: boolean } = {}): string {
  const abs = Math.abs(cents)
  const whole = abs >= WHOLE_EURO_FROM_CENTS
  const euros = whole ? Math.round(abs / 100) : abs / 100
  const body = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(euros)
  if (cents < 0) return `−${body}` // U+2212, same as formatCents
  return opts.signed ? `+${body}` : body
}
