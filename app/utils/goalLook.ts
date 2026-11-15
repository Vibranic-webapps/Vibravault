/**
 * How a goal looks: its pastel tint and its picture.
 * The five tints are tokens in main.css (--vv-tint-<name> + -fg); the server stores the name.
 */
export const GOAL_TINTS = ['mint', 'blush', 'sky', 'lavender', 'butter'] as const
export type GoalTint = (typeof GOAL_TINTS)[number]

const isTint = (v: unknown): v is GoalTint => GOAL_TINTS.includes(v as GoalTint)

/** A goal without a chosen tint still gets a stable one (same goal, same colour, every time). */
export function goalTint(goal: { id: string; tint?: string | null }): GoalTint {
  if (isTint(goal.tint)) return goal.tint
  let h = 0
  for (const ch of goal.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return GOAL_TINTS[h % GOAL_TINTS.length]!
}

/** Inline CSS variables a card sets once; everything inside reads --g-bg / --g-ink. */
export function goalTintStyle(tint: GoalTint): Record<string, string> {
  return { '--g-bg': `var(--vv-tint-${tint})`, '--g-ink': `var(--vv-tint-${tint}-fg)` }
}

/** What the server accepts (server/utils/goals.ts): keep the two in step. */
export const GOAL_IMAGE_MAX_BYTES = 150 * 1024

const bytesOf = (dataUrl: string) => Math.floor(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4)

/**
 * Shrinks a picked photo to a small data URL (WebP where the browser can, else
 * JPEG on white) that fits the server limit. Throws if it still can't fit.
 * Runs in the browser, so a 6 MB camera photo never travels to the server.
 */
export async function shrinkImage(file: File): Promise<string> {
  const bmp = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  const budget = GOAL_IMAGE_MAX_BYTES - 6 * 1024 // headroom: the server measures the decoded bytes
  for (const max of [640, 480, 360, 240]) {
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
    canvas.width = Math.max(1, Math.round(bmp.width * scale))
    canvas.height = Math.max(1, Math.round(bmp.height * scale))
    for (const [type, q] of [['image/webp', 0.82], ['image/webp', 0.65], ['image/jpeg', 0.8], ['image/jpeg', 0.6]] as const) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height) } // JPEG has no transparency
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
      const url = canvas.toDataURL(type, q)
      if (!url.startsWith(`data:${type}`)) continue // this browser can't encode that type (Safari + WebP)
      if (bytesOf(url) <= budget) { bmp.close(); return url }
    }
  }
  bmp.close()
  throw new Error('too-big')
}

/** Picture framing: ranges and defaults (the server enforces the same; server/utils/goals.ts). */
export const GOAL_FRAME = {
  focusMin: 0, focusMax: 100, focusDefault: 50,
  zoomMin: 100, zoomMax: 300, zoomDefault: 100,
  /** The Home card is 192 x 212: the editor frame uses the same shape so the crop matches. */
  cardWidth: 192, cardHeight: 212,
} as const

export interface GoalFraming { focusX: number; focusY: number; zoom: number }

export const DEFAULT_FRAMING: GoalFraming = {
  focusX: GOAL_FRAME.focusDefault, focusY: GOAL_FRAME.focusDefault, zoom: GOAL_FRAME.zoomDefault,
}

export const clampFrame = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(v)))
