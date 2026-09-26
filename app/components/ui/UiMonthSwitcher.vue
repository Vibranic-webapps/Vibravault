<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

/**
 * Previous / this month / next. The arrows are UiIconButtons, so they are
 * exactly the size of every other square button (#5). The month name follows
 * the app language ("september 2026" / "September 2026").
 */
interface Props { modelValue: string } // "2026-09"
const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [month: string] }>()
const { t } = useI18n()
const { monthName } = useFormat()

function shift(delta: number) {
  const [y, m] = props.modelValue.split('-').map(Number)
  const d = new Date(y!, m! - 1 + delta, 1)
  emit('update:modelValue', `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
}
</script>

<template>
  <div class="ms">
    <UiIconButton :icon="ChevronLeft" :label="t('month.previous')" @click="shift(-1)" />
    <span class="name" aria-live="polite">{{ monthName(modelValue) }}</span>
    <UiIconButton :icon="ChevronRight" :label="t('month.next')" @click="shift(1)" />
  </div>
</template>

<style scoped>
.ms { display: flex; align-items: center; gap: 12px; }
.name { flex: 1; min-width: 150px; text-align: center; font-size: 15px; font-weight: 700; text-transform: capitalize; }
</style>
