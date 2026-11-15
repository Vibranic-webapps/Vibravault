<script setup lang="ts">
import { Plus, Target } from 'lucide-vue-next'
import { useGoalsStore, type Goal } from '~/stores/goals'

/**
 * Every savings goal as a card, plus the sheets to open one, add / take out
 * money, edit and archive. Shared by the Goals page and the Home screen, so
 * both behave the same and nobody has to navigate to reach their goals.
 *
 * `compact` is the Home flavour: small cards in a bending carousel (tap one to
 * open it, tap its + to add money straight away) and a quiet row when there
 * are no goals yet.
 * Call `openNew()` (via a template ref) to start the New goal sheet.
 */
defineProps<{ compact?: boolean }>()

const { t } = useI18n()
const store = useGoalsStore()

const detailId = ref<string | null>(null)
const detailGoal = computed(() => store.items.find((g) => g.id === detailId.value) ?? null)

const editorOpen = ref(false)
const editing = ref<Goal | null>(null)
const moneyOpen = ref(false)
// The goal the money sheet is for: the one opened in the detail, or (from the
// carousel's +) a goal picked without opening anything.
const quickId = ref<string | null>(null)
const moneyGoal = computed(() => store.items.find((g) => g.id === (quickId.value ?? detailId.value)) ?? null)
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
  quickId.value = null
  moneyMode.value = mode
  moneyOpen.value = true
}
function quickAdd(id: string) {
  openMoney('add')
  quickId.value = id // after openMoney, which clears it. Kept on close so the sheet doesn't empty while it slides away.
}

// A freshly created goal opens straight in its detail: the next step is "add money".
function onSaved(goal: Goal) {
  if (!editing.value) detailId.value = goal.id
}

const showError = computed(() => !!store.error && !store.items.length)

defineExpose({ openNew })
</script>

<template>
  <div>
    <!-- Loading (only the very first time: after that the cached goals show at once) -->
    <div v-if="!store.loaded && !store.error" class="list" aria-busy="true" :aria-label="t('common.loading')">
      <span class="neu-3 skel" :class="{ compact }" />
    </div>

    <!-- Error -->
    <section v-else-if="showError" class="neu-3 state">
      <p class="vv-error" role="alert">{{ t('goals.loadError') }}</p>
      <UiButton variant="ghost" :block="false" @click="store.fetchAll(true)">{{ t('common.retry') }}</UiButton>
    </section>

    <!-- Empty -->
    <section v-else-if="!store.items.length && compact" class="neu-3 rows">
      <UiListRow :icon="Target" :label="t('goals.setPrompt')" @click="openNew" />
    </section>
    <section v-else-if="!store.items.length" class="neu-3 state empty">
      <UiIconTile :icon="Target" />
      <h2>{{ t('goals.emptyTitle') }}</h2>
      <p>{{ t('goals.emptyBody') }}</p>
      <UiButton :icon="Plus" :block="false" @click="openNew">{{ t('goals.new') }}</UiButton>
    </section>

    <!-- List -->
    <GoalCarousel
      v-else-if="compact"
      :goals="store.items"
      @open="detailId = $event"
      @add="quickAdd"
      @new="openNew"
    />
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
    <GoalContributionSheet :open="moneyOpen" :goal="moneyGoal" :mode="moneyMode" @close="moneyOpen = false" />
  </div>
</template>

<style scoped>
.list { display: grid; gap: 18px; }
.rows { padding: 4px 16px; }

.state { display: grid; justify-items: start; gap: 14px; padding: 22px; }
.state .vv-error { margin: 0; width: 100%; }
.empty { justify-items: center; padding: 32px 24px; text-align: center; }
.empty h2 { margin: 4px 0 0; font-size: 18px; font-weight: 800; }
.empty p { margin: 0; max-width: 36ch; font-size: 14px; line-height: 1.5; color: var(--vv-muted); }

/* Placeholder card while the list loads: same size and shape, so nothing jumps. */
.skel { display: block; height: 152px; animation: pulse 1.4s ease-in-out infinite; }
.skel.compact { height: 178px; margin: 22px 0 30px; }
@keyframes pulse { 50% { opacity: .6; } }
@media (prefers-reduced-motion: reduce) { .skel { animation: none; } }
</style>
