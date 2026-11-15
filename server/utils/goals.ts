import type { Goal, GoalContribution, Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { brusselsDayKey, goalProgress } from '~~/shared/goals'

// Savings goals: validation, serialisation and the row lock, in ONE module.
// Route files stay thin. Money is integer cents; saved is ALWAYS the SUM of the
// contributions (there is no stored total to drift).

export const GOAL_NAME_MAX = 80
export const GOAL_NOTE_MAX = 200
export const GOAL_TARGET_MAX_CENTS = 99_999_999
export const GOAL_AMOUNT_MAX_CENTS = 99_999_999

// The look of a goal (all optional). Limits live here, in one place.
export const GOAL_TINTS = ['mint', 'blush', 'sky', 'lavender', 'butter'] as const
export type GoalTint = (typeof GOAL_TINTS)[number]
export const GOAL_IMAGE_MAX_BYTES = 150 * 1024 // decoded picture; the browser already shrinks to far less
export const GOAL_IMAGE_URL_MAX = 2000
export const GOAL_IMAGE_MIMES = ['image/jpeg', 'image/webp', 'image/png'] as const
type GoalImageMime = (typeof GOAL_IMAGE_MIMES)[number]

/**
 * A goal row WITHOUT the picture bytes. Every query except the image route uses
 * `omit: goalOmitImage`, so the bytes (up to 150 KB per goal) never ride along
 * with list/get/patch. `imageMime` is set exactly when bytes are stored (DB CHECK),
 * so it doubles as the "has an uploaded picture" flag.
 */
export type GoalRow = Omit<Goal, 'imageData'>
export const goalOmitImage = { imageData: true } as const

/**
 * Error with a stable machine-readable `code` (+ the offending `field`) next to
 * the English `statusMessage`. The existing screens show statusMessage as-is;
 * a screen that wants a translated message maps `data.code` to an i18n key.
 */
export function goalError(statusCode: number, statusMessage: string, code: string, field?: string) {
  return createError({ statusCode, statusMessage, data: { code, field } })
}

export const goalNotFound = () => goalError(404, 'Goal not found', 'GOAL_NOT_FOUND')

function asObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw goalError(400, 'Request body must be a JSON object', 'BODY_INVALID')
  }
  return body as Record<string, unknown>
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T/

/** 'YYYY-MM-DD' that is a REAL calendar day (rejects 2027-02-30), as UTC midnight. */
function parseDayString(s: string): Date | null {
  if (!DAY_RE.test(s)) return null
  const d = new Date(`${s}T00:00:00.000Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? d : null
}

/** A due date is a CALENDAR DAY, stored as UTC midnight. A date-only string is
 *  taken as-is; a full ISO timestamp is reduced to its Europe/Brussels day first. */
function parseDueDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (DAY_RE.test(v)) return parseDayString(v)
  if (DATETIME_RE.test(v)) {
    // JS silently rolls 2027-02-30T... over to 2 March, so the date part must be a real day first.
    if (!parseDayString(v.slice(0, 10))) return null
    const instant = new Date(v)
    return Number.isNaN(instant.getTime()) ? null : parseDayString(brusselsDayKey(instant))
  }
  return null
}

/** A contribution date: a date-only string (-> UTC midnight, like Transaction.bookedAt) or a full ISO timestamp. */
function parseContributedAt(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (DAY_RE.test(v)) return parseDayString(v)
  if (DATETIME_RE.test(v)) {
    if (!parseDayString(v.slice(0, 10))) return null // same rollover guard as parseDueDate
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

function validName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.trim() : ''
  if (!name) throw goalError(400, 'Name is required', 'GOAL_NAME_REQUIRED', 'name')
  if (name.length > GOAL_NAME_MAX) throw goalError(400, 'Name is too long', 'GOAL_NAME_TOO_LONG', 'name')
  return name
}

function validTarget(raw: unknown): number {
  // Strict: a real integer number. "45.50" or "4550" as a string is a client bug, not something to guess at.
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1) {
    throw goalError(400, 'Target must be a whole number of cents, at least 1', 'GOAL_TARGET_INVALID', 'targetCents')
  }
  if (raw > GOAL_TARGET_MAX_CENTS) throw goalError(400, 'Target is too large', 'GOAL_TARGET_TOO_LARGE', 'targetCents')
  return raw
}

function validDueDate(raw: unknown): Date {
  const d = parseDueDate(raw)
  if (!d) throw goalError(400, 'Enter a valid due date (YYYY-MM-DD)', 'GOAL_DUE_DATE_INVALID', 'dueDate')
  return d
}

// ---- Look of a goal: tint + picture ------------------------------------------

function validTint(raw: unknown): GoalTint | null {
  if (raw === null || raw === '') return null
  if (typeof raw !== 'string' || !(GOAL_TINTS as readonly string[]).includes(raw)) {
    throw goalError(400, `Tint must be one of: ${GOAL_TINTS.join(', ')}`, 'GOAL_TINT_INVALID', 'tint')
  }
  return raw as GoalTint
}

/** A pasted picture link: https only, no embedded credentials, reasonable length. */
function validImageUrl(raw: unknown): string | null {
  if (raw === null || raw === '') return null
  if (typeof raw !== 'string') throw goalError(400, 'Image link must be text', 'GOAL_IMAGE_URL_INVALID', 'imageUrl')
  const v = raw.trim()
  if (!v) return null
  if (v.length > GOAL_IMAGE_URL_MAX) throw goalError(400, 'Image link is too long', 'GOAL_IMAGE_URL_TOO_LONG', 'imageUrl')
  let u: URL
  try {
    u = new URL(v)
  } catch {
    throw goalError(400, 'Enter a valid image link (https://...)', 'GOAL_IMAGE_URL_INVALID', 'imageUrl')
  }
  // Only https: rejects http:, javascript:, data:, file: and the rest.
  if (u.protocol !== 'https:' || !u.hostname || u.username || u.password) {
    throw goalError(400, 'The image link must start with https://', 'GOAL_IMAGE_URL_INVALID', 'imageUrl')
  }
  return u.href
}

const DATA_URL_RE = /^data:image\/(jpeg|webp|png);base64,([A-Za-z0-9+/]+={0,2})$/
// Longest legal base64 string for the byte cap: an oversized body is refused before it is decoded.
const IMAGE_BASE64_MAX_CHARS = Math.ceil(GOAL_IMAGE_MAX_BYTES / 3) * 4

/** The file's real type from its first bytes (a client-declared type alone proves nothing). */
function sniffImageMime(b: Buffer): GoalImageMime | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'image/webp'
  return null
}

/** 'data:image/jpeg;base64,...' -> bytes + mime. Size and magic bytes are checked here. */
function validImageDataUrl(raw: unknown): { data: Buffer; mime: GoalImageMime } {
  const invalid = () => goalError(400, 'Image must be a JPEG, WebP or PNG picture', 'GOAL_IMAGE_INVALID', 'image')
  const tooLarge = () => goalError(400, 'Image is too large (max 150 KB)', 'GOAL_IMAGE_TOO_LARGE', 'image')
  if (typeof raw !== 'string') throw invalid()
  // Cheap length check (prefix is at most 23 chars) before the regex/decoder sees an oversized string.
  if (raw.length > IMAGE_BASE64_MAX_CHARS + 32) throw tooLarge()
  const m = DATA_URL_RE.exec(raw)
  if (!m) throw invalid()
  const declared = `image/${m[1]}` as GoalImageMime
  const b64 = m[2]!
  if (b64.length % 4 !== 0) throw invalid()
  const data = Buffer.from(b64, 'base64')
  if (data.length === 0) throw invalid()
  if (data.length > GOAL_IMAGE_MAX_BYTES) throw tooLarge()
  if (sniffImageMime(data) !== declared) throw invalid()
  return { data, mime: declared }
}

/** The Prisma-ready look fields. Only keys that must change are present. */
interface GoalLookData {
  tint?: GoalTint | null
  imageUrl?: string | null
  imageData?: Buffer | null
  imageMime?: GoalImageMime | null
}

/**
 * Reads tint / imageUrl / image / removeImage from a body. ONE picture source at
 * a time: a new upload clears the link and a new link clears the upload.
 *  - `image` + `imageUrl` (both set), or `removeImage: true` + either -> 400 (ambiguous).
 *  - `removeImage: true` clears upload and link.
 *  - `imageUrl: null` clears only the link; `image: null` is treated as "not sent".
 */
function parseGoalLook(b: Record<string, unknown>): GoalLookData {
  const out: GoalLookData = {}
  if (b.tint !== undefined) out.tint = validTint(b.tint)

  if (b.removeImage !== undefined && typeof b.removeImage !== 'boolean') {
    throw goalError(400, 'removeImage must be true or false', 'GOAL_IMAGE_REMOVE_INVALID', 'removeImage')
  }
  const remove = b.removeImage === true
  const hasUpload = b.image !== undefined && b.image !== null
  const url = b.imageUrl === undefined ? undefined : validImageUrl(b.imageUrl)

  if ((hasUpload && url) || (remove && (hasUpload || url))) {
    throw goalError(400, 'Send one picture source at a time: a new image, a link, or removeImage', 'GOAL_IMAGE_CONFLICT', 'image')
  }

  if (hasUpload) {
    const { data, mime } = validImageDataUrl(b.image)
    out.imageData = data
    out.imageMime = mime
    out.imageUrl = null
  } else if (url) {
    out.imageUrl = url
    out.imageData = null
    out.imageMime = null
  } else if (remove) {
    out.imageUrl = null
    out.imageData = null
    out.imageMime = null
  } else if (url === null) {
    out.imageUrl = null // clear the link only
  }
  return out
}

export interface GoalCreateInput extends GoalLookData { name: string; targetCents: number; dueDate: Date | null }

export function validateGoalCreate(body: unknown): GoalCreateInput {
  const b = asObject(body)
  return {
    name: validName(b.name),
    targetCents: validTarget(b.targetCents),
    dueDate: b.dueDate === undefined || b.dueDate === null || b.dueDate === '' ? null : validDueDate(b.dueDate),
    ...parseGoalLook(b),
  }
}

/** PATCH: only the fields that are present change. `dueDate: null` clears the deadline. */
export function validateGoalPatch(body: unknown): Partial<GoalCreateInput> {
  const b = asObject(body)
  const data: Partial<GoalCreateInput> = {}
  if (b.name !== undefined) data.name = validName(b.name)
  if (b.targetCents !== undefined) data.targetCents = validTarget(b.targetCents)
  if (b.dueDate !== undefined) data.dueDate = b.dueDate === null || b.dueDate === '' ? null : validDueDate(b.dueDate)
  Object.assign(data, parseGoalLook(b))
  if (Object.keys(data).length === 0) {
    throw goalError(400, 'Nothing to update', 'GOAL_NOTHING_TO_UPDATE')
  }
  return data
}

export interface ContributionInput { amountCents: number; contributedAt: Date; note: string | null }

export function validateContributionInput(body: unknown): ContributionInput {
  const b = asObject(body)

  const amount = b.amountCents
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount === 0) {
    throw goalError(400, 'Amount must be a non-zero whole number of cents', 'CONTRIBUTION_AMOUNT_INVALID', 'amountCents')
  }
  if (Math.abs(amount) > GOAL_AMOUNT_MAX_CENTS) {
    throw goalError(400, 'Amount is too large', 'CONTRIBUTION_AMOUNT_TOO_LARGE', 'amountCents')
  }

  const contributedAt = parseContributedAt(b.contributedAt)
  if (!contributedAt) {
    throw goalError(400, 'Enter a valid date (YYYY-MM-DD)', 'CONTRIBUTION_DATE_INVALID', 'contributedAt')
  }

  let note: string | null = null
  if (b.note !== undefined && b.note !== null) {
    if (typeof b.note !== 'string') throw goalError(400, 'Note must be text', 'CONTRIBUTION_NOTE_INVALID', 'note')
    const trimmed = b.note.trim()
    if (trimmed.length > GOAL_NOTE_MAX) throw goalError(400, 'Note is too long', 'CONTRIBUTION_NOTE_TOO_LONG', 'note')
    note = trimmed || null
  }

  return { amountCents: amount, contributedAt, note }
}

// ---- Serialisation ----------------------------------------------------------

const dayOf = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

/**
 * Where the picture loads from: our own image route for an upload (cache-busted
 * by updatedAt, so a replaced picture shows at once), else the pasted https link,
 * else null. Never the bytes.
 */
export function goalImageSrc(goal: Pick<GoalRow, 'id' | 'imageMime' | 'imageUrl' | 'updatedAt'>): string | null {
  if (goal.imageMime) return `/api/goals/${goal.id}/image?v=${goal.updatedAt.getTime()}`
  return goal.imageUrl
}

/** The goal as the API returns it: stored fields + progress, all from the one pure function. */
export function serializeGoal(goal: GoalRow, savedCents: number, now = new Date()) {
  return {
    id: goal.id,
    name: goal.name,
    targetCents: goal.targetCents,
    dueDate: dayOf(goal.dueDate), // 'YYYY-MM-DD' calendar day, or null
    tint: goal.tint, // 'mint' | 'blush' | 'sky' | 'lavender' | 'butter' | null
    imageSrc: goalImageSrc(goal), // URL for <img src>, or null
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
    ...goalProgress({ targetCents: goal.targetCents, savedCents, dueDate: goal.dueDate, now }),
  }
}

export function serializeContribution(c: GoalContribution) {
  return {
    id: c.id,
    goalId: c.goalId,
    amountCents: c.amountCents,
    contributedAt: c.contributedAt,
    note: c.note,
    createdAt: c.createdAt,
  }
}

// ---- Queries ----------------------------------------------------------------

type Db = Prisma.TransactionClient | typeof prisma

/** Saved total per goal (SUM of contributions). Goals with none are absent -> 0. */
export async function savedByGoal(userId: string, goalIds: string[], db: Db = prisma): Promise<Map<string, number>> {
  if (goalIds.length === 0) return new Map()
  const rows = await db.goalContribution.groupBy({
    by: ['goalId'],
    where: { userId, goalId: { in: goalIds } },
    _sum: { amountCents: true },
  })
  return new Map(rows.map((r) => [r.goalId, r._sum.amountCents ?? 0]))
}

/** The user's live goal, or a 404. Someone else's goal and a deleted goal look identical. */
export async function findOwnedGoal(userId: string, id: string, db: Db = prisma): Promise<GoalRow> {
  const goal = await db.goal.findFirst({ where: { id, userId, deletedAt: null }, omit: goalOmitImage })
  if (!goal) throw goalNotFound()
  return goal
}

/**
 * Run `fn` inside a transaction that holds a row lock on the goal.
 *
 * "Read the saved total, then write" races: two simultaneous withdrawals could
 * both see enough money and both succeed. SELECT ... FOR UPDATE on the Goal row
 * makes the second one wait until the first has committed, then see its result.
 * Ownership + soft-delete are part of the locking query, so a foreign or deleted
 * goal yields the same 404 as a missing one.
 */
export async function withLockedGoal<T>(
  userId: string,
  goalId: string,
  fn: (tx: Prisma.TransactionClient, goal: GoalRow) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Goal"
      WHERE "id" = ${goalId} AND "userId" = ${userId} AND "deletedAt" IS NULL
      FOR UPDATE`
    if (locked.length === 0) throw goalNotFound()
    const goal = await tx.goal.findUniqueOrThrow({ where: { id: goalId }, omit: goalOmitImage })
    return fn(tx, goal)
  })
}

/** The stored picture of the user's live goal, or a 404 (also when the goal has no uploaded picture). */
export async function findOwnedGoalImage(userId: string, id: string): Promise<{ data: Buffer; mime: string }> {
  const g = await prisma.goal.findFirst({
    where: { id, userId, deletedAt: null },
    select: { imageData: true, imageMime: true },
  })
  if (!g?.imageData || !g.imageMime) throw goalNotFound()
  return { data: Buffer.from(g.imageData), mime: g.imageMime }
}
