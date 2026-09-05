import { defineStore } from 'pinia'

export type CategoryKind = 'INCOME' | 'EXPENSE'

export interface Category {
  id: string
  name: string
  kind: CategoryKind
  icon: string
  /** Design-system token name (cat-1..12), NOT a hex - resolves per theme. */
  color: string
}

export interface CategoryInput {
  name: string
  kind: CategoryKind
  icon: string
  color: string
}

export const useCategoriesStore = defineStore('categories', () => {
  // State
  const items = ref<Category[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref(false)

  // Getters
  const income = computed(() => items.value.filter((c) => c.kind === 'INCOME'))
  const expense = computed(() => items.value.filter((c) => c.kind === 'EXPENSE'))
  const byId = computed(() => new Map(items.value.map((c) => [c.id, c])))

  // Actions
  function message(e: unknown): string {
    if (typeof e === 'object' && e && 'statusMessage' in e) {
      const m = (e as { statusMessage?: unknown }).statusMessage
      if (typeof m === 'string') return m
    }
    return e instanceof Error ? e.message : 'Something went wrong'
  }

  async function fetchAll(force = false) {
    if (loaded.value && !force) return
    loading.value = true
    error.value = null
    try {
      // useRequestFetch forwards cookies during SSR; plain $fetch would arrive
      // at the API with no session and get a 401.
      items.value = await useRequestFetch()<Category[]>('/api/categories')
      loaded.value = true
    } catch (e: unknown) {
      error.value = message(e)
    } finally {
      loading.value = false
    }
  }

  async function create(input: CategoryInput) {
    error.value = null
    try {
      const created = await $fetch<Category>('/api/categories', { method: 'POST', body: input })
      items.value.push(created)
      return true
    } catch (e: unknown) {
      error.value = message(e)
      return false
    }
  }

  async function update(id: string, input: CategoryInput) {
    error.value = null
    try {
      const updated = await $fetch<Category>(`/api/categories/${id}`, { method: 'PATCH', body: input })
      const i = items.value.findIndex((c) => c.id === id)
      if (i !== -1) items.value[i] = updated
      return true
    } catch (e: unknown) {
      error.value = message(e)
      return false
    }
  }

  async function remove(id: string) {
    error.value = null
    try {
      await $fetch(`/api/categories/${id}`, { method: 'DELETE' })
      items.value = items.value.filter((c) => c.id !== id)
      return true
    } catch (e: unknown) {
      error.value = message(e)
      return false
    }
  }

  return { items, loading, error, loaded, income, expense, byId, fetchAll, create, update, remove }
})
