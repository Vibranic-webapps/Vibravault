import { defineStore } from 'pinia'

export interface MerchantRule {
  id: string
  match: string
  label: string | null
  categoryId: string | null
  createdAt: string
}

export interface RuleInput {
  match: string
  label: string | null
  categoryId: string | null
  applyToExisting: boolean
}

export const useRulesStore = defineStore('rules', () => {
  // State
  const items = ref<MerchantRule[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Actions
  function message(e: unknown): string {
    if (typeof e === 'object' && e && 'statusMessage' in e) {
      const m = (e as { statusMessage?: unknown }).statusMessage
      if (typeof m === 'string') return m
    }
    return e instanceof Error ? e.message : 'Something went wrong'
  }

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      items.value = await useRequestFetch()<MerchantRule[]>('/api/rules')
    } catch (e: unknown) {
      error.value = message(e)
    } finally {
      loading.value = false
    }
  }

  /** Returns how many existing rows were filed, or null on failure. */
  async function create(input: RuleInput): Promise<number | null> {
    error.value = null
    try {
      const res = await $fetch<{ rule: MerchantRule; categorised: number }>('/api/rules', {
        method: 'POST',
        body: input,
      })
      items.value = [res.rule, ...items.value]
      return res.categorised
    } catch (e: unknown) {
      error.value = message(e)
      return null
    }
  }

  async function remove(id: string) {
    error.value = null
    try {
      await $fetch(`/api/rules/${id}`, { method: 'DELETE' })
      items.value = items.value.filter((r) => r.id !== id)
      return true
    } catch (e: unknown) {
      error.value = message(e)
      return false
    }
  }

  return { items, loading, error, fetchAll, create, remove }
})
