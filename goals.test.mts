/**
 * Tests for goalProgress (savings goals). Run:  npx tsx goals.test.mts
 * All amounts are made-up round numbers - no personal data in a public repo.
 */
import { goalProgress, sumCents, brusselsDayKey, type GoalProgress } from './shared/goals'

// "Now" is always an explicit instant so no test depends on the real clock.
const at = (iso: string) => new Date(iso)
const dueUtc = (day: string) => new Date(`${day}T00:00:00.000Z`) // how the API stores a due date

interface Case {
  name: string
  input: Parameters<typeof goalProgress>[0]
  expect: Partial<GoalProgress>
}

const cases: Case[] = [
  {
    name: 'no contributions',
    input: { targetCents: 100000, savedCents: sumCents([]) },
    expect: { savedCents: 0, remainingCents: 100000, percent: 0, isReached: false, weeksLeft: null, neededPerWeekCents: null, isOverdue: false },
  },
  {
    name: 'partial: 25.5% rounds DOWN to 25',
    input: { targetCents: 100000, savedCents: sumCents([10000, 15500]) },
    expect: { savedCents: 25500, remainingCents: 74500, percent: 25, isReached: false },
  },
  {
    name: '99.99% is still 99, not 100',
    input: { targetCents: 100000, savedCents: 99999 },
    expect: { remainingCents: 1, percent: 99, isReached: false },
  },
  {
    name: 'exactly reached',
    input: { targetCents: 100000, savedCents: 100000 },
    expect: { remainingCents: 0, percent: 100, isReached: true, neededPerWeekCents: null },
  },
  {
    name: 'over target: remaining stays 0, percent clamps to 100',
    input: { targetCents: 100000, savedCents: 130000 },
    expect: { savedCents: 130000, remainingCents: 0, percent: 100, isReached: true },
  },
  {
    name: 'withdrawal lowers saved (+50000, -20000)',
    input: { targetCents: 100000, savedCents: sumCents([50000, -20000]) },
    expect: { savedCents: 30000, remainingCents: 70000, percent: 30, isReached: false },
  },
  {
    name: 'withdrawal takes a reached goal back below target',
    input: { targetCents: 100000, savedCents: sumCents([100000, -1]) },
    expect: { remainingCents: 1, percent: 99, isReached: false },
  },
  {
    name: 'no dueDate: no weeks, no per-week amount, never overdue',
    input: { targetCents: 100000, savedCents: 0, dueDate: null, now: at('2026-11-09T09:00:00Z') },
    expect: { weeksLeft: null, neededPerWeekCents: null, isOverdue: false },
  },
  {
    name: 'due today: weeksLeft minimum 1, whole remainder needed this week',
    input: { targetCents: 100000, savedCents: 40000, dueDate: dueUtc('2026-11-09'), now: at('2026-11-09T09:00:00Z') },
    expect: { weeksLeft: 1, neededPerWeekCents: 60000, isOverdue: false },
  },
  {
    name: 'due tomorrow: still 1 week',
    input: { targetCents: 100000, savedCents: 0, dueDate: dueUtc('2026-11-10'), now: at('2026-11-09T09:00:00Z') },
    expect: { weeksLeft: 1, neededPerWeekCents: 100000 },
  },
  {
    name: 'exactly 7 days = 1 week',
    input: { targetCents: 100000, savedCents: 0, dueDate: dueUtc('2026-11-16'), now: at('2026-11-09T09:00:00Z') },
    expect: { weeksLeft: 1, neededPerWeekCents: 100000 },
  },
  {
    name: '8 days = 2 weeks, split in two',
    input: { targetCents: 100000, savedCents: 0, dueDate: dueUtc('2026-11-17'), now: at('2026-11-09T09:00:00Z') },
    expect: { weeksLeft: 2, neededPerWeekCents: 50000 },
  },
  {
    name: 'overdue and not reached: per-week null, isOverdue true',
    input: { targetCents: 100000, savedCents: 40000, dueDate: dueUtc('2026-11-08'), now: at('2026-11-09T09:00:00Z') },
    expect: { weeksLeft: 0, neededPerWeekCents: null, isOverdue: true, remainingCents: 60000 },
  },
  {
    name: 'past the date but reached: done, not overdue',
    input: { targetCents: 100000, savedCents: 100000, dueDate: dueUtc('2026-11-08'), now: at('2026-11-09T09:00:00Z') },
    expect: { isOverdue: false, isReached: true, neededPerWeekCents: null },
  },
  {
    name: 'reached before the deadline: no per-week amount',
    input: { targetCents: 100000, savedCents: 100000, dueDate: dueUtc('2027-04-24'), now: at('2026-11-09T09:00:00Z') },
    expect: { isReached: true, neededPerWeekCents: null, isOverdue: false },
  },
  {
    name: 'per-week amount rounds UP to whole cents (100000 / 3 weeks)',
    input: { targetCents: 100000, savedCents: 0, dueDate: dueUtc('2026-11-30'), now: at('2026-11-09T09:00:00Z') },
    // 21 days = exactly 3 weeks; 100000 / 3 = 33333.33 -> 33334
    expect: { weeksLeft: 3, neededPerWeekCents: 33334 },
  },
  {
    // The real-life shape: a 24 Apr 2027 deadline, saving from 9 Nov 2026.
    // 166 days = 23.7 weeks -> 24. 455000 / 24 = 18958.33 -> 18959.
    name: '24 Apr 2027 target seen from 9 Nov 2026: 24 weeks',
    input: { targetCents: 455000, savedCents: 0, dueDate: dueUtc('2027-04-24'), now: at('2026-11-09T09:00:00Z') },
    expect: { weeksLeft: 24, neededPerWeekCents: 18959, remainingCents: 455000, percent: 0 },
  },
  {
    name: 'due date as a plain YYYY-MM-DD string works the same',
    input: { targetCents: 455000, savedCents: 0, dueDate: '2027-04-24', now: at('2026-11-09T09:00:00Z') },
    expect: { weeksLeft: 24, neededPerWeekCents: 18959 },
  },
  {
    // 23:30 UTC on 8 Nov is already 00:30 on 9 Nov in Brussels (winter, UTC+1).
    // Counting against the UTC day would give 1 extra day (and here an extra week).
    name: 'Brussels midnight: 23:30 UTC on 8 Nov is already 9 Nov, so a 9 Nov deadline is "today"',
    input: { targetCents: 100000, savedCents: 0, dueDate: dueUtc('2026-11-09'), now: at('2026-11-08T23:30:00Z') },
    expect: { weeksLeft: 1, isOverdue: false },
  },
  {
    name: 'Brussels midnight: 22:30 UTC on 8 Nov is 23:30 local, so a 8 Nov deadline is still today',
    input: { targetCents: 100000, savedCents: 0, dueDate: dueUtc('2026-11-08'), now: at('2026-11-08T22:30:00Z') },
    expect: { weeksLeft: 1, isOverdue: false },
  },
  {
    name: 'Brussels midnight: due 8 Nov is OVERDUE at 23:30 UTC on 8 Nov (it is 9 Nov locally)',
    input: { targetCents: 100000, savedCents: 0, dueDate: dueUtc('2026-11-08'), now: at('2026-11-08T23:30:00Z') },
    expect: { isOverdue: true, weeksLeft: 0 },
  },
  {
    name: 'DST: the spring-forward weekend does not shift the week count (28 days = 4 weeks)',
    input: { targetCents: 400000, savedCents: 0, dueDate: dueUtc('2027-04-14'), now: at('2027-03-17T12:00:00Z') },
    expect: { weeksLeft: 4, neededPerWeekCents: 100000 },
  },
]

// Day-key helper on its own: summer time is UTC+2.
const dayKeyChecks: Array<[string, string, string]> = [
  ['winter, 23:30 UTC rolls over', '2026-11-08T23:30:00Z', '2026-11-09'],
  ['summer, 21:59 UTC is still the same day', '2026-07-01T21:59:00Z', '2026-07-01'],
  ['summer, 22:00 UTC rolls over', '2026-07-01T22:00:00Z', '2026-07-02'],
]

let pass = 0
let total = 0

for (const c of cases) {
  total++
  const got = goalProgress(c.input)
  const bad = (Object.keys(c.expect) as Array<keyof GoalProgress>).filter((k) => got[k] !== c.expect[k])
  const ok = bad.length === 0
  if (ok) pass++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${c.name}`)
  if (!ok) console.log(`        expected ${JSON.stringify(c.expect)}\n        got      ${JSON.stringify(got)}`)
}

for (const [name, iso, want] of dayKeyChecks) {
  total++
  const got = brusselsDayKey(at(iso))
  const ok = got === want
  if (ok) pass++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  brusselsDayKey: ${name}`)
  if (!ok) console.log(`        expected ${want}, got ${got}`)
}

console.log(`\n  ${pass}/${total} passing`)
if (pass !== total) process.exit(1)
