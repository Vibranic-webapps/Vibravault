import { randomBytes } from 'node:crypto'
import { parseAmountToCents } from '~~/shared/utils/money'

export interface TransactionInput {
  amountCents: number
  bookedAt: Date
  categoryId: string | null
  counterparty: string | null
  description: string | null
}

/**
 * Manual transactions still need a fingerprint (the column is NOT NULL), but
 * they must never collide with each other: two identical coffees typed by hand
 * are two real transactions, and the partial unique index on
 * (userId, fingerprint) WHERE deletedAt IS NULL would reject the second.
 *
 * So manual rows get a RANDOM fingerprint. Dedupe is a property of imported
 * data, not of hand entry - the user typing it twice means they meant it twice.
 */
export function manualFingerprint(): string {
  return `manual:${randomBytes(16).toString('hex')}`
}

export function validateTransactionInput(body: any): TransactionInput {
  const cents = typeof body?.amountCents === 'number'
    ? Math.trunc(body.amountCents)
    : parseAmountToCents(String(body?.amount ?? ''))

  if (cents === null || !Number.isFinite(cents)) {
    throw createError({ statusCode: 400, statusMessage: 'Enter a valid amount' })
  }
  if (cents === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Amount cannot be zero' })
  }
  // Int is 32-bit: ~21 million euro. Generous, but guard it rather than let
  // Postgres throw an opaque error.
  if (Math.abs(cents) > 2_000_000_000) {
    throw createError({ statusCode: 400, statusMessage: 'Amount is too large' })
  }

  const bookedAt = new Date(String(body?.bookedAt ?? ''))
  if (Number.isNaN(bookedAt.getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'Enter a valid date' })
  }

  const str = (v: unknown, max: number) => {
    const s = typeof v === 'string' ? v.trim() : ''
    return s ? s.slice(0, max) : null
  }

  return {
    amountCents: cents,
    bookedAt,
    categoryId: typeof body?.categoryId === 'string' && body.categoryId ? body.categoryId : null,
    counterparty: str(body?.counterparty, 120),
    description: str(body?.description, 500),
  }
}

/**
 * PATCH semantics: validate and return ONLY the fields present in the body.
 *
 * The previous PATCH ran the full-create validator, so any field the caller
 * omitted came back as null and was written to the row - a PUT wearing a PATCH
 * name. The edit form never tripped it because it always sends every field,
 * but a bulk "set category" call sending just { categoryId } would have wiped
 * the counterparty and description of every row it touched. Found 2026-09-26
 * when a partial test request erased imported bank descriptions.
 *
 * `key in body` rather than truthiness, so an explicit null (e.g. clearing a
 * category) is still honoured as a deliberate change.
 */
export function validateTransactionPatch(body: any): Partial<TransactionInput> {
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Nothing to update' })
  }
  const out: Partial<TransactionInput> = {}

  if ('amount' in body || 'amountCents' in body) {
    const cents = typeof body.amountCents === 'number'
      ? Math.trunc(body.amountCents)
      : parseAmountToCents(String(body.amount ?? ''))
    if (cents === null || !Number.isFinite(cents)) {
      throw createError({ statusCode: 400, statusMessage: 'Enter a valid amount' })
    }
    if (cents === 0) throw createError({ statusCode: 400, statusMessage: 'Amount cannot be zero' })
    if (Math.abs(cents) > 2_000_000_000) {
      throw createError({ statusCode: 400, statusMessage: 'Amount is too large' })
    }
    out.amountCents = cents
  }

  if ('bookedAt' in body) {
    const d = new Date(String(body.bookedAt ?? ''))
    if (Number.isNaN(d.getTime())) throw createError({ statusCode: 400, statusMessage: 'Enter a valid date' })
    out.bookedAt = d
  }

  const str = (v: unknown, max: number) => {
    const t = typeof v === 'string' ? v.trim() : ''
    return t ? t.slice(0, max) : null
  }
  if ('categoryId' in body) {
    out.categoryId = typeof body.categoryId === 'string' && body.categoryId ? body.categoryId : null
  }
  if ('counterparty' in body) out.counterparty = str(body.counterparty, 120)
  if ('description' in body) out.description = str(body.description, 500)

  if (Object.keys(out).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Nothing to update' })
  }
  return out
}
