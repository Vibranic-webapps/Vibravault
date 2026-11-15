<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

/**
 * Previous / this week / next - the week twin of UiMonthSwitcher.
 * Shows the range ("9 - 15 Nov"). No way past the current week: there is
 * nothing to look at in the future, so the next arrow is simply not there.
 */
interface Props {
  /** First and last day of the shown week, "YYYY-MM-DD". */
  from: string
  to: string
  canNext: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{ prev: []; next: [] }>()
const { t } = useI18n()
const { date } = useFormat()

// "9 - 15 Nov" in one month, "26 Oct - 1 Nov" across two.
const label = computed(() => {
  const sameMonth = props.from.slice(0, 7) === props.to.slice(0, 7)
  const start = date(props.from, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' })
  return `${start} – ${date(props.to, { day: 'numeric', month: 'short' })}`
})
</script>

<template>
  <div class="ws">
    <UiIconButton :icon="ChevronLeft" :label="t('insights.weekPrev')" @click="emit('prev')" />
    <span class="name" aria-live="polite">{{ label }}</span>
    <UiIconButton v-if="canNext" :icon="ChevronRight" :label="t('insights.weekNext')" @click="emit('next')" />
    <!-- Keeps the label centred where the arrow would be. -->
    <span v-else class="gap" aria-hidden="true" />
  </div>
</template>

<style scoped>
.ws { display: flex; align-items: center; gap: 12px; }
.name { flex: 1; min-width: 150px; text-align: center; font-size: 15px; font-weight: 700; }
.gap { width: var(--vv-control); height: var(--vv-control); flex: none; }
</style>
