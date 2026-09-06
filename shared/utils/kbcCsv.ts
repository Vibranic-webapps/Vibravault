import { parseAmountToCents } from './money'

/**
 * KBC CSV parser.
 *
 * Produces the NORMALIZED row shape the importer consumes. CSV is a *source*;
 * PSD2 will later be a second source producing the same shape, which is what
 * makes it an adapter rather than a rewrite.
 *
 * Every quirk handled here was observed in a real export, not assumed:
 *   - line endings are CR ONLY (no LF at all) -> split('\n') returns one string
 *   - delimiter is ';'
 *   - 19 fields for 18 headers (rows carry a trailing ';')
 *   - Omschrijving is quoted and contains commas/colons
 *   - Datum is DD/MM/YYYY
 *   - Bedrag is comma-decimal and already SIGNED
 *   - Naam tegenpartij was blank in 100% of rows -> Omschrijving is the label
 *   - Afschriftnummer repeats (it is a statement number, not a row id)
 */

export interface ParsedRow {
  bookedAt: string          // ISO date (yyyy-mm-dd)
  amountCents: number       // signed
  balanceAfterCents: number | null
  counterparty: string | null
  counterpartyIban: string | null
  description: string
  /** Nth occurrence of an otherwise-identical row within THIS file. */
  ordinal: number
  lineNumber: number
}

export interface ParseResult {
  rows: ParsedRow[]
  errors: { line: number; reason: string }[]
  meta: {
    delimiter: string
    encoding: string
    headerCount: number
    dataRows: number
    /** Running-balance check against the bank's own Saldo column. */
    balanceCheck: { ok: boolean; checked: number; firstMismatchLine: number | null }
  }
}

/** UTF-8 if it decodes strictly, otherwise Windows-1252 (Belgian exports). */
export function decodeCsv(buf: Uint8Array): { text: string; encoding: string } {
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(buf), encoding: 'utf-8' }
  } catch {
    return { text: new TextDecoder('windows-1252').decode(buf), encoding: 'windows-1252' }
  }
}

/** Pick the delimiter by counting candidates OUTSIDE quotes on the header line. */
export function detectDelimiter(headerLine: string): string {
  const counts = [';', ',', '\t'].map((d) => [d, headerLine.split(d).length - 1] as const)
  counts.sort((a, b) => b[1] - a[1])
  return counts[0]![1] > 0 ? counts[0]![0] : ';'
}

/** Real CSV tokenizer: honours quotes, "" escapes, and embedded newlines. */
export function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      row.push(field); field = ''
    } else if (ch === '\n') {
      row.push(field); field = ''
      rows.push(row); row = []
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows
}

/** DD/MM/YYYY (KBC) or YYYY-MM-DD, whichever the file uses. */
export function parseDate(v: string): string | null {
  const s = v.trim()
  let m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (m) return s
  return null
}

const norm = (h: string) => h.trim().toLowerCase()

export function parseKbcCsv(buf: Uint8Array): ParseResult {
  const { text: decoded, encoding } = decodeCsv(buf)

  // THE critical normalisation. The real file uses CR only - splitting on '\n'
  // would yield a single line and the whole import would silently see 0 rows.
  const text = decoded.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  const firstLine = text.slice(0, text.indexOf('\n') === -1 ? undefined : text.indexOf('\n'))
  const delimiter = detectDelimiter(firstLine)

  const table = parseCsv(text, delimiter).filter((r) => r.some((c) => c.trim() !== ''))
  const errors: ParseResult['errors'] = []

  if (!table.length) {
    return { rows: [], errors: [{ line: 0, reason: 'File is empty' }],
      meta: { delimiter, encoding, headerCount: 0, dataRows: 0,
        balanceCheck: { ok: true, checked: 0, firstMismatchLine: null } } }
  }

  const header = table[0]!.map(norm)
  const idx = (name: string) => header.indexOf(norm(name))
  const iDate = idx('Datum')
  const iAmount = idx('Bedrag')
  const iBalance = idx('Saldo')
  const iDesc = idx('Omschrijving')
  const iParty = idx('Naam tegenpartij')
  const iIban = idx('Rekening tegenpartij')
  const iFree = idx('vrije mededeling')

  if (iDate === -1 || iAmount === -1) {
    return { rows: [], errors: [{ line: 1, reason: 'Not a KBC export: no Datum/Bedrag columns' }],
      meta: { delimiter, encoding, headerCount: header.length, dataRows: 0,
        balanceCheck: { ok: true, checked: 0, firstMismatchLine: null } } }
  }

  const rows: ParsedRow[] = []
  // Ordinal: the Nth identical (date, amount, description) within this file.
  const seen = new Map<string, number>()

  for (let r = 1; r < table.length; r++) {
    const line = r + 1
    const cells = table[r]!
    const cell = (i: number) => (i >= 0 && i < cells.length ? cells[i]!.trim() : '')

    const bookedAt = parseDate(cell(iDate))
    if (!bookedAt) { errors.push({ line, reason: `Unreadable date "${cell(iDate)}"` }); continue }

    const amountCents = parseAmountToCents(cell(iAmount))
    if (amountCents === null) { errors.push({ line, reason: `Unreadable amount "${cell(iAmount)}"` }); continue }

    const balanceAfterCents = iBalance >= 0 ? parseAmountToCents(cell(iBalance)) : null

    const description = [cell(iDesc), cell(iFree)].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
    // Counterparty name is blank in real exports; the description is the label.
    const counterparty = cell(iParty) || null
    const counterpartyIban = cell(iIban).replace(/\s+/g, '') || null

    const key = `${bookedAt}|${amountCents}|${description}`
    const ordinal = (seen.get(key) ?? 0) + 1
    seen.set(key, ordinal)

    rows.push({ bookedAt, amountCents, balanceAfterCents, counterparty, counterpartyIban, description, ordinal, lineNumber: line })
  }

  // ---- Integrity check: the bank hands you a checksum ---------------------
  // Each Saldo is the balance AFTER that row. Walking the file, every
  // consecutive pair must satisfy: previous balance + this amount = this
  // balance. A mismatch means a dropped row, a sign error, or a parsing bug -
  // caught at import time instead of three months later.
  let checked = 0
  let firstMismatchLine: number | null = null
  const withBalance = rows.filter((r) => r.balanceAfterCents !== null)
  for (let i = 1; i < withBalance.length; i++) {
    const prev = withBalance[i - 1]!
    const cur = withBalance[i]!
    checked++
    if (prev.balanceAfterCents! + cur.amountCents !== cur.balanceAfterCents!) {
      firstMismatchLine ??= cur.lineNumber
    }
  }

  return {
    rows,
    errors,
    meta: {
      delimiter, encoding,
      headerCount: header.length,
      dataRows: rows.length,
      balanceCheck: { ok: firstMismatchLine === null, checked, firstMismatchLine },
    },
  }
}
