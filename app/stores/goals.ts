import { defineStore } from 'pinia'
import { serverMessage } from '~/utils/serverMessage'

/**
 * Savings goals. Mirrors the API in server/api/goals/** - the progress numbers
 * (savedCents, percent, neededPerWeekCents ...) are computed by the server, and
 * this store never recomputes them. Every write returns the fresh goal, which
 * replaces the old one in place, so no refetch is needed after a change.
 *
 * Money is INTEGER CENTS everywhere in here.
 */

export interface Goal {
  id: string
  name: string
  targetCents: number
  /** Calendar day 'YYYY-MM-DD', or null = no deadline. */
  dueDate: string | null
  createdAt: string
  updatedAt: string
  savedCents: number
  remainingCents: number
  /** Whole percent 0-100 (rounded down). */
  percent: number
  isReached: boolean
  /** null = no due date, 0 = overdue. */
  weeksLeft: number | null
  /** null = no due date, reached or overdue. */
  neededPerWeekCents: number | null
  isOverdue: boolean
}

export interface GoalContribution {
  id: string
  goalId: string
  /** Signed: + saved, - taken out. */
  amountCents: number
  /** ISO timestamp (a day-only date arrives as UTC midnight). */
  contributedAt: string
  note: string | null
  createdAt: string
}

export interface GoalInput {
  name: string
  targetCents: number
  dueDate?: string | null
}
export type GoalPatch = Partial<GoalInput>
export interface ContributionInput {
  amountCents: number
  /** 'YYYY-MM-DD' */
  contributedAt: string
  note?: string
}

/** Why a request failed, in a shape the screens can translate. */
export interface GoalFailure {
  status: number | null
  /** Stable machine code from the API (GOAL_NAME_REQUIRED ...), if it sent one. */
  code: string | null
  /** The form field the error belongs to: name | targetCents | dueDate | amountCents | contributedAt | note. */
  field: string | null
  savedCents: number | null
  /** The server's English text - only a last-resort fallback. */
  message: string
}

/** Same limits as server/utils/goals.ts (that file can't be imported client-side: it pulls in Prisma). */
export const GOAL_LIMITS = {
  nameMax: 80,
  noteMax: 200,
  maxCents: 99_999_999,
} as const

/**
 * "220", "220,5", "220.50", "€ 1234,56" -> integer cents. Null if it isn't a
 * plain positive amount with at most 2 decimals.
 * Pure integer maths on the digits: no parseFloat, so 0.1 + 0.2 style drift
 * cannot happen. Thousands separators are deliberately NOT accepted: "1.234"
 * is ambiguous (1,234 or 1.234?) and a wrong guess is a wrong goal.
 */
export function parseEuroToCents(raw: string): number | null {
  const m = /^€?(\d{1,9})(?:[.,](\d{1,2}))?$/.exec(raw.replace(/\s/g, ''))
  if (!m) return null
  const euros = Number(m[1])
  const cents = Number((m[2] ?? '').padEnd(2, '0') || '0')
  return euros * 100 + cents
}

/** Pull a GoalFailure out of whatever $fetch threw. */
function toFailure(e: unknown): GoalFailure {
  const err = e as { statusCode?: number; data?: { data?: { code?: string; field?: string; savedCents?: number } } } | null
  // createError({ data }) arrives as response body { statusCode, statusMessage, data: { code, field } }.
  const d = err?.data?.data
  return {
    status: err?.statusCode ?? null,
    code: d?.code ?? null,
    field: d?.field ?? null,
    savedCents: typeof d?.savedCents === 'number' ? d.savedCents : null,
    message: serverMessage(e) || (e instanceof Error ? e.message : ''),
  }
}

/**
 * The failure as a sentence in the current language. Unknown codes fall back
 * to the server's English text, then to a generic line.
 */
export function goalErrorMessage(
  f: GoalFailure,
  i18n: { t: (key: string, named?: Record<string, unknown>) => string; te: (key: string) => boolean },
  money: (cents: number) => string,
): string {
  const { t, te } = i18n
  const key = f.code ? `goals.err.${f.code}` : ''
  if (key && te(key)) {
    return t(key, {
      saved: money(f.savedCents ?? 0),
      nameMax: GOAL_LIMITS.nameMax,
      noteMax: GOAL_LIMITS.noteMax,
    })
  }
  return f.message || t('goals.err.generic')
}

export const useGoalsStore = defineStore('goals', () => {
  // State
  const items = ref<Goal[]>([])
  const loading = ref(false)
  /** Set when the LIST failed to load. Write failures go to `failure` instead. */
  const error = ref<string | null>(null)
  const loaded = ref(false)
  /** The last failed write/detail request - read it right after a call returned null/false. */
  const failure = ref<GoalFailure | null>(null)
  /** Contributions per goal id, newest first. Filled by fetchContributions. */
  const contributions = ref<Record<string, GoalContribution[]>>({})

  // Getters
  /**
   * The goal the dashboard shows: earliest due date among the unreached goals;
   * with no dated unreached goal, the first unreached one; with nothing
   * unreached, the first goal at all.
   */
  const featured = computed<Goal | null>(() => {
    const open = items.value.filter((g) => !g.isReached)
    const dated = open.filter((g) => g.dueDate).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
    return dated[0] ?? open[0] ?? items.value[0] ?? null
  })

  // Helpers
  function fail(e: unknown): GoalFailure {
    failure.value = toFailure(e)
    return failure.value
  }

  /** Swap a goal for its fresh version (or append it when it's new). */
  function replaceGoal(goal: Goal) {
    const i = items.value.findIndex((g) => g.id === goal.id)
    if (i === -1) items.value.push(goal)
    else items.value[i] = goal
  }

  /** Newest first, like the API: by day, then by when it was entered. */
  function sortContributions(list: GoalContribution[]) {
    return [...list].sort((a, b) =>
      b.contributedAt.localeCompare(a.contributedAt) || b.createdAt.localeCompare(a.createdAt))
  }

  // Actions
  async function fetchAll(force = false) {
    if (loaded.value && !force) return
    loading.value = true
    error.value = null
    try {
      // useRequestFetch forwards the cookie during SSR (plain $fetch would get a 401).
      items.value = await useRequestFetch()<Goal[]>('/api/goals')
      loaded.value = true
    } catch (e: unknown) {
      error.value = toFailure(e).message || 'Something went wrong'
    } finally {
      loading.value = false
    }
  }

  async function create(input: GoalInput): Promise<Goal | null> {
    failure.value = null
    try {
      const goal = await $fetch<Goal>('/api/goals', { method: 'POST', body: input })
      replaceGoal(goal)
      return goal
    } catch (e: unknown) {
      fail(e)
      return null
    }
  }

  async function update(id: string, patch: GoalPatch): Promise<Goal | null> {
    failure.value = null
    try {
      const goal = await $fetch<Goal>(`/api/goals/${id}`, { method: 'PATCH', body: patch })
      replaceGoal(goal)
      return goal
    } catch (e: unknown) {
      fail(e)
      return null
    }
  }

  /** "Archive" = the API's soft delete. */
  async function archive(id: string): Promise<boolean> {
    failure.value = null
    try {
      await $fetch(`/api/goals/${id}`, { method: 'DELETE' })
      items.value = items.value.filter((g) => g.id !== id)
      delete contributions.value[id]
      return true
    } catch (e: unknown) {
      fail(e)
      return false
    }
  }

  /** Load one goal's contributions (also refreshes the goal itself). */
  async function fetchContributions(id: string): Promise<boolean> {
    failure.value = null
    try {
      const { contributions: list, ...goal } = await $fetch<Goal & { contributions: GoalContribution[] }>(`/api/goals/${id}`)
      contributions.value[id] = list
      replaceGoal(goal)
      return true
    } catch (e: unknown) {
      fail(e)
      return false
    }
  }

  async function addContribution(goalId: string, input: ContributionInput): Promise<GoalContribution | null> {
    failure.value = null
    try {
      const res = await $fetch<{ contribution: GoalContribution; goal: Goal }>(
        `/api/goals/${goalId}/contributions`,
        { method: 'POST', body: input },
      )
      replaceGoal(res.goal)
      // Only touch the list if it was loaded; otherwise the detail view fetches it fresh.
      const known = contributions.value[goalId]
      if (known) contributions.value[goalId] = sortContributions([res.contribution, ...known])
      return res.contribution
    } catch (e: unknown) {
      fail(e)
      return null
    }
  }

  async function removeContribution(goalId: string, contributionId: string): Promise<boolean> {
    failure.value = null
    try {
      const res = await $fetch<{ ok: boolean; goal: Goal }>(
        `/api/goals/${goalId}/contributions/${contributionId}`,
        { method: 'DELETE' },
      )
      replaceGoal(res.goal)
      contributions.value[goalId] = (contributions.value[goalId] ?? []).filter((c) => c.id !== contributionId)
      return true
    } catch (e: unknown) {
      fail(e)
      return false
    }
  }

  return {
    items, loading, error, loaded, failure, contributions, featured,
    fetchAll, create, update, archive, fetchContributions, addContribution, removeContribution,
  }
})
