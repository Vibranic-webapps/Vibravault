<script setup lang="ts">
import { CircleCheck, Clock } from 'lucide-vue-next'
import type { Goal } from '~/stores/goals'

/**
 * One savings goal as a raised card: name, percent, progress bar, saved of
 * target, and one line that answers "what do I still need to do?"
 * (X per week for N weeks / reached / past the due date).
 *
 * `to` makes the whole card a link (dashboard); without it the card is a
 * button that emits `click` (the goals list opens the detail sheet).
 * `compact` drops the due-date line for the dashboard.
 */
interface Props { goal: Goal; to?: string; compact?: boolean }
const props = defineProps<Props>()
const emit = defineEmits<{ click: [] }>()

const { t } = useI18n()
const { money, date } = useFormat()

// NuxtLink is auto-imported, not registered: resolveComponent gets the real one.
const NuxtLinkComp = resolveComponent('NuxtLink')
const tag = computed(() => (props.to ? NuxtLinkComp : 'button'))

const dueText = computed(() =>
  props.goal.dueDate
    // The due date is a calendar day stored as UTC midnight: format it as UTC so it can't slide a day.
    ? t('goals.dueOn', { date: date(props.goal.dueDate, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) })
    : '',
)
</script>

<template>
  <component
    :is="tag"
    :to="to"
    :type="to ? undefined : 'button'"
    class="neu-3 gcard"
    @click="!to && emit('click')"
  >
    <span class="top">
      <span class="name">{{ goal.name }}</span>
      <span class="pct">{{ goal.percent }}%</span>
    </span>

    <GoalProgressBar :percent="goal.percent" :label="t('goals.progressLabel', { name: goal.name })" />

    <span class="amounts">
      <strong>{{ money(goal.savedCents) }}</strong>
      <span class="of">{{ t('goals.of', { target: money(goal.targetCents) }) }}</span>
    </span>

    <span class="status" :class="{ done: goal.isReached }">
      <template v-if="goal.isReached">
        <CircleCheck :size="16" aria-hidden="true" />{{ t('goals.reached') }}
      </template>
      <template v-else-if="goal.isOverdue">
        <Clock :size="16" aria-hidden="true" />{{ t('goals.overdue', { amount: money(goal.remainingCents) }) }}
      </template>
      <template v-else-if="goal.neededPerWeekCents !== null && goal.weeksLeft !== null">
        {{ t('goals.perWeek', { amount: money(goal.neededPerWeekCents) }) }} ·
        {{ t('goals.weeksLeft', { n: goal.weeksLeft }, goal.weeksLeft) }}
      </template>
      <template v-else>{{ t('goals.toGo', { amount: money(goal.remainingCents) }) }}</template>
    </span>

    <span v-if="dueText && !compact" class="due">{{ dueText }}</span>
  </component>
</template>

<style scoped>
.gcard {
  display: flex; flex-direction: column; gap: 12px; width: 100%; padding: 20px;
  font: inherit; text-align: left; text-decoration: none; color: var(--vv-text);
  border: none; cursor: pointer; -webkit-tap-highlight-color: transparent;
  transition: box-shadow .12s ease;
}
.gcard:active { box-shadow: var(--vv-p3); }
.gcard:focus-visible { outline: 2px solid var(--vv-accent-ring); outline-offset: 3px; }

.top { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.name { min-width: 0; font-size: 17px; font-weight: 800; overflow-wrap: anywhere; }
.pct { font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--vv-muted); }

.amounts { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; font-variant-numeric: tabular-nums; }
.amounts strong { font-size: 20px; font-weight: 800; }
.of { font-size: 14px; color: var(--vv-muted); }

.status { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }
.status.done { color: var(--vv-goal); }
.due { font-size: 13px; color: var(--vv-muted); }
</style>
