<script setup lang="ts">
import { ChevronLeft, Plus } from 'lucide-vue-next'
import { useGoalsStore } from '~/stores/goals'

/**
 * Savings goals: every goal as a card (GoalsPanel), with the sheets to open
 * one, add / take out money, edit and archive. The same panel sits on Home,
 * so this page is the full list (and the way in from You).
 *
 * Not a tab: reached from Home ("See all") and from You.
 */
const { t } = useI18n()
const store = useGoalsStore()
const panel = ref<{ openNew: () => void } | null>(null)

// Back goes to wherever the user came from: Home or You.
const router = useRouter()
const back = computed(() => (router.options.history.state.back === '/you' ? '/you' : '/'))

// Fetched on the client, so the skeleton shows while it loads instead of a blank page.
onMounted(() => store.fetchAll(true))

onPullRefresh(async () => {
  await store.fetchAll(true)
  if (store.error) throw new Error('refresh failed')
})
</script>

<template>
  <div>
    <header class="head">
      <UiIconButton :icon="ChevronLeft" :label="t('common.back')" :to="back" />
      <h1>{{ t('goals.title') }}</h1>
      <UiIconButton :icon="Plus" :label="t('goals.new')" @click="panel?.openNew()" />
    </header>

    <GoalsPanel ref="panel" />
  </div>
</template>

<style scoped>
.head { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
h1 { flex: 1; min-width: 0; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -.01em; }
</style>
