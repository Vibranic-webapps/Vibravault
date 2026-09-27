<script setup lang="ts">
import { CircleDashed } from 'lucide-vue-next'

/**
 * One transaction in a list: category tile · name + date · amount.
 * A <button>, because tapping it opens the drawer. Used on Home now and on
 * the Transactions screen in its redesign.
 *
 * Amount colour: money in = accent, out = negative, and transfers between
 * your own accounts stay NEUTRAL - they're not income or spending.
 */
interface Props {
  label: string
  bookedAt: string
  amountCents: number
  icon?: string | null
  color?: string | null
  transfer?: boolean
  /** Second line. Defaults to the date; lists grouped by day show the category instead. */
  sub?: string | null
}
const props = withDefaults(defineProps<Props>(), { icon: null, color: null, transfer: false, sub: null })
const emit = defineEmits<{ click: [] }>()
const { money, date } = useFormat()

const amountClass = computed(() =>
  props.transfer ? 'vv-amount-transfer' : props.amountCents > 0 ? 'vv-amount-in' : 'vv-amount-out',
)
const tile = computed(() =>
  props.color ? { background: `var(--vv-${props.color})`, color: `var(--vv-${props.color}-fg)` } : {},
)
</script>

<template>
  <button type="button" class="tx" @click="emit('click')">
    <!-- No category yet = a dashed circle: "still open", not a broken icon. -->
    <span class="tile neu" :style="tile" aria-hidden="true">
      <template v-if="icon">{{ icon }}</template>
      <CircleDashed v-else :size="18" />
    </span>
    <span class="main">
      <span class="name">{{ label }}</span>
      <span class="when">{{ sub ?? date(bookedAt, { weekday: 'short', day: 'numeric', month: 'short' }) }}</span>
    </span>
    <span class="amount" :class="amountClass">{{ money(amountCents, { signed: amountCents > 0 }) }}</span>
  </button>
</template>

<style scoped>
.tx {
  display: flex; align-items: center; gap: 13px; width: 100%;
  min-height: 60px; padding: 8px 2px;
  font: inherit; text-align: left; color: var(--vv-text);
  background: none; border: none; cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.tx + .tx { border-top: 1px solid var(--vv-shadow-dark); }
.tx:focus-visible { outline: 2px solid var(--vv-accent-ring); outline-offset: 2px; border-radius: 8px; }
.tile {
  display: grid; place-items: center; width: 40px; height: 40px; flex: none;
  font-size: 17px; color: var(--vv-muted); border-radius: var(--vv-r-sm);
}
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.name { font-size: 15px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.when { font-size: 12px; color: var(--vv-muted); }
.amount { font-size: 15px; font-weight: 700; white-space: nowrap; }
</style>
