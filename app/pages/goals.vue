<script setup lang="ts">
import { ChevronLeft, Plus, Target } from 'lucide-vue-next'
import { useGoalsStore, type Goal } from '~/stores/goals'

/**
 * Savings goals: a card per goal (saved of target, bar, what to save per
 * week). Tap a card for the detail sheet - activity, add / take out money,
 * edit, archive. Everything opens as a sheet, so the list never reloads.
 *
 * Not a tab: reached from the Home card and from You.
 */
const { t } = useI18n()
const store = useGoalsStore()

// Back goes to wherever the user came from: Home (the card) or You (the row).
const router = useRouter()
const back = computed(() => (router.options.history.state.back === '/you' ? '/you' : '/'))

// Fetched on the client, so the skeleton shows while it loads instead of a blank page.
onMounted(() => store.fetchAll(true))

onPullRefresh(async () => {
  await store.fetchAll(true)
  if (store.error) throw new Error('refresh failed')
})

// ---- Sheets ------------------------------------------------------------------
const detailId = ref<string | null>(null)
const detailGoal = computed(() => store.items.find((g) => g.id === detailId.value) ?? null)

const editorOpen = ref(false)
const editing = ref<Goal | null>(null)
const moneyOpen = ref(false)
const moneyMode = ref<'add' | 'take'>('add')

function openNew() {
  editing.value = null
  editorOpen.value = true
}
function openEdit() {
  editing.value = detailGoal.value
  editorOpen.value = true
}
function openMoney(mode: 'add' | 'take') {
  moneyMode.value = mode
  moneyOpen.value = true
}

// A freshly created goal opens straight in its detail: the next step is "add money".
function onSaved(goal: Goal) {
  if (!editing.value) detailId.value = goal.id
}

const showError = computed(() => !!store.error && !store.items.length)
</script>

<template>
  <div>
    <header class="head">
      <UiIconButton :icon="ChevronLeft" :label="t('common.back')" :to="back" />
      <h1>{{ t('goals.title') }}</h1>
      <UiIconButton :icon="Plus" :label="t('goals.new')" @click="openNew" />
    </header>

    <!-- Loading -->
    <div v-if="!store.loaded && !store.error" class="list" aria-busy="true" :aria-label="t('common.loading')">
      <span class="neu-3 skel" /><span class="neu-3 skel" />
    </div>

    <!-- Error -->
    <section v-else-if="showError" class="neu-3 state">
      <p class="vv-error" role="alert">{{ t('goals.loadError') }}</p>
      <UiButton variant="ghost" :block="false" @click="store.fetchAll(true)">{{ t('common.retry') }}</UiButton>
    </section>

    <!-- Empty -->
    <section v-else-if="!store.items.length" class="neu-3 state empty">
      <UiIconTile :icon="Target" />
      <h2>{{ t('goals.emptyTitle') }}</h2>
      <p>{{ t('goals.emptyBody') }}</p>
      <UiButton :icon="Plus" :block="false" @click="openNew">{{ t('goals.new') }}</UiButton>
    </section>

    <!-- List -->
    <div v-else class="list">
      <GoalCard v-for="g in store.items" :key="g.id" :goal="g" @click="detailId = g.id" />
    </div>

    <GoalDetailSheet
      :goal-id="detailId"
      :busy="editorOpen || moneyOpen"
      @close="detailId = null"
      @add="openMoney('add')"
      @take-out="openMoney('take')"
      @edit="openEdit"
    />
    <GoalSheet :open="editorOpen" :goal="editing" @close="editorOpen = false" @saved="onSaved" />
    <GoalContributionSheet :open="moneyOpen" :goal="detailGoal" :mode="moneyMode" @close="moneyOpen = false" />
  </div>
</template>

<style scoped>
.head { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
h1 { flex: 1; min-width: 0; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -.01em; }
.list { display: grid; gap: 18px; }

.state { display: grid; justify-items: start; gap: 14px; padding: 22px; }
.state .vv-error { margin: 0; width: 100%; }
.empty { justify-items: center; padding: 32px 24px; text-align: center; }
.empty h2 { margin: 4px 0 0; font-size: 18px; font-weight: 800; }
.empty p { margin: 0; max-width: 36ch; font-size: 14px; line-height: 1.5; color: var(--vv-muted); }

/* Placeholder card while the list loads: same size and shape, so nothing jumps. */
.skel { display: block; height: 152px; animation: pulse 1.4s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: .6; } }
@media (prefers-reduced-motion: reduce) { .skel { animation: none; } }
</style>
