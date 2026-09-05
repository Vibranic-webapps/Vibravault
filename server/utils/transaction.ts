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
