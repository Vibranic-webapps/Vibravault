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

/** Smallest arc we draw for a non-zero slice, as a fraction of the circle (~4 degrees). */
export const MIN_VISIBLE_ARC = 0.012

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
  const small = rows.filter((r) => r.fraction < minArc)
  const bigShare = rows.filter((r) => r.fraction >= minArc).reduce((sum, r) => sum + r.fraction, 0)
  const room = 1 - small.length * minArc
  // If so many slices are tiny that stretching them would eat the whole ring,
  // fall back to the true proportions rather than drawing nonsense.
  const stretch = small.length > 0 && room > 0 && bigShare > 0
  const shrink = stretch ? room / bigShare : 1

  let start = 0
  return rows.map((r) => {
    const arc = stretch ? (r.fraction < minArc ? minArc : r.fraction * shrink) : r.fraction
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
