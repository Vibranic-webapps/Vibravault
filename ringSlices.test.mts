/**
 * Tests for the ring maths. Run:  npx tsx ringSlices.test.mts
 * Fake round numbers only - no personal data in a public repo.
 */
import { ringSlices, percentOfTotal, groupSmallest, ringGeometry, pointOnRing, placePopup, MIN_VISIBLE_ARC, RING_RADIUS, RING_STROKE, RING_GAP } from './app/utils/ringSlices'

const checks: { name: string; ok: boolean; detail?: unknown }[] = []
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  checks.push({ name, ok, detail: ok ? undefined : { want, got } })
}
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9

// ---- percentOfTotal ---------------------------------------------------------
eq('percent: 18 of 100', percentOfTotal(18, 100), 18)
eq('percent: rounds half up', percentOfTotal(1, 8), 13)
eq('percent: zero total is 0, not NaN', percentOfTotal(500, 0), 0)
eq('percent: negative total is 0', percentOfTotal(500, -10), 0)
eq('percent: over 100 is allowed (spent more than income)', percentOfTotal(150, 100), 150)

// ---- plain split ------------------------------------------------------------
{
  const s = ringSlices([{ key: 'sub', cents: 1800 }, { key: 'other', cents: 5200 }, { key: 'left', cents: 3000 }])
  eq('split: arcs add up to the full circle', near(sum(s.map((x) => x.arc)), 1), true)
  eq('split: percents', s.map((x) => x.percent), [18, 52, 30])
  eq('split: first starts at 0', s[0]!.start, 0)
  eq('split: slices are contiguous', near(s[1]!.start, s[0]!.arc) && near(s[2]!.start, s[0]!.arc + s[1]!.arc), true)
  eq('split: nothing tiny', s.some((x) => x.tiny), false)
}

// ---- single slice = whole ring -----------------------------------------------
{
  const s = ringSlices([{ key: 'only', cents: 1234 }])
  eq('single slice: full circle', [s[0]!.start, s[0]!.arc, s[0]!.percent], [0, 1, 100])
}

// ---- zero / garbage ---------------------------------------------------------
eq('no inputs: no slices', ringSlices([]), [])
eq('all zero: no slices', ringSlices([{ key: 'a', cents: 0 }, { key: 'b', cents: 0 }]), [])
eq('negative and NaN are dropped', ringSlices([{ key: 'a', cents: -5 }, { key: 'b', cents: NaN }]), [])
{
  const s = ringSlices([{ key: 'a', cents: 0 }, { key: 'b', cents: 700 }])
  eq('zero slice dropped, the other fills the ring', [s.length, s[0]!.key, s[0]!.arc], [1, 'b', 1])
}

// ---- tiny slices stay visible, text stays honest ----------------------------
{
  const s = ringSlices([{ key: 'big', cents: 1_000_000 }, { key: 'dust', cents: 10 }, { key: 'mid', cents: 250_000 }])
  const dust = s.find((x) => x.key === 'dust')!
  eq('tiny: drawn at the minimum arc', dust.arc, MIN_VISIBLE_ARC)
  eq('tiny: percent text is the truth (0 -> shown as "<1%")', [dust.percent, dust.tiny], [0, true])
  eq('tiny: real fraction is untouched', dust.fraction < 0.0001, true)
  eq('tiny: arcs still add up to 1', near(sum(s.map((x) => x.arc)), 1), true)
}
{
  // 0.9% is below the minimum arc (1.2%): stretched, but the text still says 1%.
  const s = ringSlices([{ key: 'a', cents: 9_910 }, { key: 'b', cents: 90 }])
  eq('0.9%: stretched, says 1%', [s[1]!.arc, s[1]!.percent, s[1]!.tiny], [MIN_VISIBLE_ARC, 1, false])
}
{
  // So many tiny slices that stretching them all would eat the ring: keep true proportions.
  const many = Array.from({ length: 100 }, (_, i) => ({ key: `k${i}`, cents: 1 }))
  const s = ringSlices(many)
  eq('too many tiny slices: still sums to 1', near(sum(s.map((x) => x.arc)), 1), true)
}

// ---- minimum arc: 7.5%, and shrinking never pushes another slice under it ------
{
  eq('min arc is 7.5%', MIN_VISIBLE_ARC, 0.075)
  // Two slices just above the minimum before shrinking, just under it after.
  const s = ringSlices([{ key: 'big', cents: 90_000 }, { key: 'edge', cents: 8_000 }, { key: 'dust', cents: 100 }, { key: 'zero', cents: 0 }])
  eq('min arc: zero slice is not drawn', s.some((x) => x.key === 'zero'), false)
  eq('min arc: every drawn slice is at least the minimum', s.every((x) => x.arc >= MIN_VISIBLE_ARC - 1e-12), true)
  eq('min arc: still adds up to the circle', near(sum(s.map((x) => x.arc)), 1), true)
  eq('min arc: percent text stays exact', s.map((x) => x.percent), [92, 8, 0])
}
{
  // A slice that only falls under the minimum AFTER the others were shrunk.
  const s = ringSlices([{ key: 'a', cents: 80 }, { key: 'b', cents: 7 }, { key: 'c', cents: 1 }, { key: 'd', cents: 7 }])
  eq('min arc (cascade): all slices >= minimum', s.every((x) => x.arc >= MIN_VISIBLE_ARC - 1e-12), true)
  eq('min arc (cascade): sums to 1', near(sum(s.map((x) => x.arc)), 1), true)
}

// ---- geometry: caps, gaps, one slice ----------------------------------------
{
  const circ = 2 * Math.PI * RING_RADIUS
  const s = ringSlices([{ key: 'a', cents: 500 }, { key: 'b', cents: 500 }])
  const g = ringGeometry(s)
  eq('geometry: dash = arc minus stroke and gap', near(g[0]!.dash, 0.5 * circ - RING_STROKE - RING_GAP), true)
  eq('geometry: slices do not overlap (caps + gap fit)', near(g[1]!.offset, -(0.5 * circ + (RING_STROKE + RING_GAP) / 2)), true)
  eq('geometry: mid points', g.map((x) => x.mid), [0.25, 0.75])
  const one = ringGeometry(ringSlices([{ key: 'only', cents: 1 }]))
  eq('geometry: a single slice is a full circle, no gap', [one[0]!.full, near(one[0]!.dash, circ), one[0]!.offset], [true, true, 0])
  const tiny = ringGeometry(ringSlices([{ key: 'big', cents: 1_000_000 }, { key: 'dust', cents: 1 }]))
  eq('geometry: the tiny slice still has a positive dash', tiny[1]!.dash > 1, true)
  const p = pointOnRing(0.25, 75, 75, 50)
  eq('pointOnRing: 25% is 3 o-clock', [Math.round(p.x), Math.round(p.y)], [125, 75])
}

// ---- popup placement never leaves the box ------------------------------------
{
  const base = { cx: 66, cy: 66, outerRadius: 45, innerRadius: 30, width: 120, height: 48, boxWidth: 132, boxHeight: 132 }
  let inside = true
  for (let i = 0; i < 100; i++) {
    const { left, top } = placePopup({ ...base, mid: i / 100 })
    if (left < 0 || top < 0 || left + base.width > base.boxWidth + 1e-9 || top + base.height > base.boxHeight + 1e-9) inside = false
  }
  eq('popup: stays inside the half-width card at every angle', inside, true)
  // A popup wider than the box is pinned to the left edge instead of overflowing to a negative position.
  eq('popup: wider than the box pins to 0', placePopup({ ...base, width: 200, mid: 0.5 }).left, 0)
  // Room above and below: top-half slice goes above, bottom-half below.
  const roomy = { ...base, cy: 100, boxHeight: 200 }
  const up = placePopup({ ...roomy, mid: 0 })
  const down = placePopup({ ...roomy, mid: 0.5 })
  eq('popup: top slice puts it above, bottom slice below', up.top + roomy.height <= roomy.cy - roomy.outerRadius && down.top >= roomy.cy + roomy.outerRadius, true)
}

// ---- overspend (caller passes sub + other only; the ring is full) -------------
{
  const s = ringSlices([{ key: 'sub', cents: 30_000 }, { key: 'other', cents: 90_000 }, { key: 'left', cents: 0 }])
  eq('overspend: two slices, full ring', [s.length, near(sum(s.map((x) => x.arc)), 1)], [2, true])
}

// ---- grouping ----------------------------------------------------------------
{
  const cat = (n: number) => ({ id: `c${n}`, totalCents: 1000 - n })
  const six = groupSmallest(Array.from({ length: 6 }, (_, i) => cat(i)))
  eq('group: 6 categories stay as 6', [six.shown.length, six.rest], [6, null])
  const eight = groupSmallest(Array.from({ length: 8 }, (_, i) => cat(i)))
  eq('group: 8 -> top 5 + rest of 3', [eight.shown.length, eight.rest?.count], [5, 3])
  eq('group: rest cents is the exact sum of the tail', eight.rest?.cents, 995 + 994 + 993)
  eq('group: shown + rest = all the money', sum(eight.shown.map((c) => c.totalCents)) + eight.rest!.cents, sum(Array.from({ length: 8 }, (_, i) => 1000 - i)))
}

let pass = 0
for (const c of checks) {
  if (c.ok) pass++
  console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name}`)
  if (!c.ok) console.log(`        ${JSON.stringify(c.detail)}`)
}
console.log(`\n  ${pass}/${checks.length} passing`)
if (pass !== checks.length) process.exit(1)
