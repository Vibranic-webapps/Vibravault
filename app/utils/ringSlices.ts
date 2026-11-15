/**
 * Ring maths shared by the donut charts (spending ring, category ring).
 *
 * Pure and integer-cents in: no Vue, no stored floats. Returns, per slice, where
 * it starts and how long its arc is as FRACTIONS of the full circle (0..1), plus
 * a rounded percentage for the text.
 *
 * Two different numbers on purpose:
 *   - `arc`     is what gets DRAWN. A tiny slice is stretched to MIN_VISIBLE_ARC
 *               so it can still be seen / tapped, and the others shrink a hair
 *               so the arcs still add up to exactly one full circle.
 *   - `percent` is what gets SAID. It always comes from the real cents, so the
 *               stretched slice never claims a bigger share than it has.
 */

/**
 * Smallest arc we draw for a non-zero slice, as a fraction of the circle (7.5% = 27 degrees).
 * Big enough that, after the round caps and the gap are taken off (see ringGeometry),
 * a thumb can still hit it.
 */
export const MIN_VISIBLE_ARC = 0.075

/** More categories than this and the smallest ones are folded into one "Other" slice. */
export const GROUP_WHEN_MORE_THAN = 6
/** How many categories stay on their own when grouping kicks in. */
export const GROUP_KEEP = 5

/** Stand-in key for "not sorted" (a null categoryId) wherever a category is picked by key. */
export const UNSORTED_KEY = '__unsorted'

export interface RingInput {
  key: string
  /** Integer cents. Zero or negative inputs are dropped (they have no arc). */
  cents: number
}

export interface RingSlice {
  key: string
  cents: number
  /** Real share of the total, 0..1. */
  fraction: number
  /** Real share as a whole percent for display. 0 when `tiny`. */
  percent: number
  /** True when the slice is real money but rounds to 0%: show "<1%", not "0%". */
  tiny: boolean
  /** Drawn start, fraction of the circle, clockwise from 12 o'clock. */
  start: number
  /** Drawn length, fraction of the circle. */
  arc: number
}

/** Whole-percent share of `total`; 0 when there is no total (never NaN / Infinity). */
export function percentOfTotal(cents: number, total: number): number {
  if (!(total > 0) || !(cents > 0)) return 0
  return Math.round((cents * 100) / total)
}

/** Slices for a ring, in the order given. Empty when there is nothing to draw. */
export function ringSlices(inputs: RingInput[], minArc: number = MIN_VISIBLE_ARC): RingSlice[] {
  const live = inputs.filter((i) => Number.isFinite(i.cents) && i.cents > 0)
  const total = live.reduce((sum, i) => sum + i.cents, 0)
  if (total <= 0) return []

  const rows = live.map((i) => ({ ...i, fraction: i.cents / total }))

  // Stretch every slice below the minimum up to it, and shrink the rest so the
  // arcs still add up to one circle. Shrinking can push another slice under the
  // minimum, so repeat until nothing changes (at most one pass per slice).
  const pinned = new Set<string>()
  let scale = 1
  for (let pass = 0; pass <= rows.length; pass++) {
    const freeShare = rows.filter((r) => !pinned.has(r.key)).reduce((sum, r) => sum + r.fraction, 0)
    const room = 1 - pinned.size * minArc
    // Too many tiny slices to give each the minimum: keep the true proportions.
    if (room <= 0 || freeShare <= 0) { pinned.clear(); scale = 1; break }
    scale = room / freeShare
    const next = rows.filter((r) => !pinned.has(r.key) && r.fraction * scale < minArc)
    if (!next.length) break
    for (const r of next) pinned.add(r.key)
  }

  let start = 0
  return rows.map((r, index) => {
    const isLast = index === rows.length - 1
    // A stretched slice is exactly the minimum; the last free slice closes the circle (no float dust at 12 o'clock).
    const arc = pinned.has(r.key) ? minArc : isLast && pinned.size > 0 ? Math.max(0, 1 - start) : r.fraction * scale
    const percent = percentOfTotal(r.cents, total)
    const slice: RingSlice = {
      key: r.key,
      cents: r.cents,
      fraction: r.fraction,
      percent,
      tiny: percent === 0,
      start,
      arc,
    }
    start += arc
    return slice
  })
}

// ---- Drawing: round caps, gaps, popup placement ---------------------------------

/** What the ring is drawn with, in SVG units (the ring SVG is 150 x 150). */
export const RING_VIEW = 150
export const RING_RADIUS = 54
export const RING_STROKE = 15
/** Clear space between two neighbouring slices (round caps included). */
export const RING_GAP = 4

export interface RingArc {
  key: string
  /** stroke-dasharray is `${dash} ${circumference}`. */
  dash: number
  /** stroke-dashoffset. */
  offset: number
  /** Middle of the slice, 0..1 clockwise from 12 o'clock. */
  mid: number
  /** True when the whole ring is one slice: no caps, no gap. */
  full: boolean
}

/**
 * Turns slices into stroke-dasharray numbers. Round caps add half a stroke width
 * past each end of a dash, so each dash is shortened by one stroke width plus the
 * gap; the minimum arc keeps even a short dash from vanishing.
 */
export function ringGeometry(
  slices: { key: string; start: number; arc: number }[],
  radius: number = RING_RADIUS,
  stroke: number = RING_STROKE,
  gap: number = RING_GAP,
): RingArc[] {
  const circumference = 2 * Math.PI * radius
  const full = slices.length === 1
  return slices.map((s) => {
    const begin = s.start * circumference
    const length = s.arc * circumference
    if (full) return { key: s.key, dash: circumference, offset: 0, mid: s.start + s.arc / 2, full }
    return {
      key: s.key,
      dash: Math.max(length - stroke - gap, 0.01),
      offset: -(begin + (stroke + gap) / 2),
      mid: s.start + s.arc / 2,
      full,
    }
  })
}

/** A point on the circle `mid` (0..1 clockwise from 12 o'clock) at distance `r` from the centre. */
export function pointOnRing(mid: number, cx: number, cy: number, r: number): { x: number; y: number } {
  const angle = mid * 2 * Math.PI - Math.PI / 2
  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r }
}

export interface PopupPlacement {
  /** Ring centre and radii in the box's own pixels (box = what the popup must stay inside). */
  cx: number
  cy: number
  outerRadius: number
  innerRadius: number
  /** Slice middle, 0..1. */
  mid: number
  /** Popup size and the box it has to stay inside. */
  width: number
  height: number
  boxWidth: number
  boxHeight: number
  /** Space kept between the slice and the popup. */
  margin?: number
}

/**
 * Where a popup's top-left goes. It sits just OUTSIDE the slice (above for the
 * top half, below for the bottom half) when that fits inside the box, and flips
 * to just INSIDE the ring otherwise. Slices on the far left/right centre it
 * vertically. The result is always clamped into the box, so it can never
 * overflow the card, however small.
 */
export function placePopup(p: PopupPlacement): { left: number; top: number } {
  const margin = p.margin ?? 4
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi))
  const out = pointOnRing(p.mid, p.cx, p.cy, p.outerRadius + margin)
  const inner = pointOnRing(p.mid, p.cx, p.cy, p.innerRadius - margin)
  const upper = out.y < p.cy
  const sideways = Math.abs(out.y - p.cy) < p.outerRadius * 0.3

  let top: number
  if (sideways) {
    top = p.cy - p.height / 2
  } else {
    const outside = upper ? out.y - p.height : out.y
    const fits = outside >= 0 && outside + p.height <= p.boxHeight
    top = fits ? outside : upper ? inner.y : inner.y - p.height
  }
  const x = sideways ? inner.x : out.x
  return {
    left: clamp(x - p.width / 2, 0, p.boxWidth - p.width),
    top: clamp(top, 0, p.boxHeight - p.height),
  }
}

/**
 * Keep the biggest `keep` entries and fold the rest into one extra entry, but
 * only when there are more than `groupWhenMoreThan` of them (6 stay as 6).
 * `rest` is null when nothing was folded. Input should be sorted big -> small.
 */
export function groupSmallest<T extends { totalCents: number }>(
  sorted: T[],
  keep: number = GROUP_KEEP,
  groupWhenMoreThan: number = GROUP_WHEN_MORE_THAN,
): { shown: T[]; rest: { cents: number; count: number } | null } {
  if (sorted.length <= groupWhenMoreThan) return { shown: sorted, rest: null }
  const tail = sorted.slice(keep)
  return {
    shown: sorted.slice(0, keep),
    rest: { cents: tail.reduce((sum, c) => sum + c.totalCents, 0), count: tail.length },
  }
}
