/**
 * Money is INTEGER CENTS everywhere. Floats are never used for arithmetic:
 * 0.1 + 0.2 !== 0.3, and in a finance app that is a balance silently wrong
 * forever. Parse at the edge, compute in cents, format at the edge.
 */

/**
 * Parse user/CSV input into signed integer cents.
 *
 * Handles the Belgian format the bank actually emits - comma decimal, dot
 * thousands ("-1.234,56") - and the plain form a user might type ("42.18").
 * Deliberately does the work with STRING manipulation: `parseFloat('-1.234,56')`
 * returns -1.234, which is wrong by a factor of 1000 and still looks plausible.
 *
 * Returns null when the input is not a number at all.
 */
export function parseAmountToCents(input: string): number | null {
  let s = String(input).trim().replace(/\s/g, '').replace(/€/g, '')
  if (!s) return null

  const negative = s.startsWith('-')
  if (negative || s.startsWith('+')) s = s.slice(1)

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')

  if (lastComma !== -1 && lastDot !== -1) {
    // Both present: whichever comes LAST is the decimal separator,
    // the other is a thousands separator.
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (lastComma !== -1) {
    // Only commas. "1,50" is decimal; "1,234" with exactly 3 digits after is
    // ambiguous, but in a Belgian context comma means decimal - so treat it so.
    s = s.replace(/\./g, '').replace(',', '.')
  }
  // Only dots (or neither): already in a JS-parseable shape.

  if (!/^\d*\.?\d*$/.test(s) || s === '' || s === '.') return null

  const [whole, frac = ''] = s.split('.')
  const cents = Number(whole || '0') * 100 + Number((frac + '00').slice(0, 2) || '0')
  if (!Number.isFinite(cents)) return null

  return negative ? -cents : cents
}

// One formatter per locale, built once. Intl.NumberFormat is expensive to
// construct and this runs for every amount on every render.
const formatters = new Map<string, Intl.NumberFormat>()
function eur(locale: string): Intl.NumberFormat {
  let f = formatters.get(locale)
  if (!f) {
    f = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' })
    formatters.set(locale, f)
  }
  return f
}

/**
 * Format cents for display. `signed` forces an explicit + on income.
 * `locale` follows the app language: nl-BE writes "€ 1.234,56", en-GB writes
 * "€1,234.56". Defaults to nl-BE, the bank's own convention.
 */
export function formatCents(cents: number, opts: { signed?: boolean; locale?: string } = {}): string {
  const body = eur(opts.locale ?? 'nl-BE').format(Math.abs(cents) / 100)
  if (cents < 0) return `−${body}`          // U+2212 minus, not a hyphen
  return opts.signed ? `+${body}` : body
}

/** Plain value for an <input>, no currency symbol: 4218 -> "42,18" */
export function centsToInput(cents: number): string {
  return (Math.abs(cents) / 100).toFixed(2).replace('.', ',')
}
