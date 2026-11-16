<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import { useRecurringStore, type Occ, type OccState } from '~/stores/recurring'
import { useRecurringText } from './recurringText'

/**
 * Home's "Coming up" card: the next few BILLS (never income) as a flat list.
 * Today-based, so it sits OUTSIDE the month wrapper that dims while a month loads.
 *
 * Shows nothing at all for someone with no recurring items yet (the empty state
 * that teaches lives on the Recurring page, so Home stays calm). With items but
 * nothing due soon it says so, and names the next bill.
 */
export interface ComingUpItem {
  itemId: string
  name: string
  direction: 'OUT'
  dueOn: string
  expectedMinCents: number
  expectedMaxCents: number
  state: OccState
  paidOn: string | null
  transactionId: string | null
  daysUntil: number
}

const props = defineProps<{ items: ComingUpItem[] }>()
const emit = defineEmits<{ open: [itemId: string, occ: Occ] }>()

const { t } = useI18n()
const store = useRecurringStore()
const { shortDate } = useRecurringText()

// The next open bill after today, for the "nothing due soon" line.
const nextBill = computed(() => {
  const open = store.items
    .filter((i) => i.active && i.direction === 'OUT' && i.next)
    .sort((a, b) => a.next!.dueOn.localeCompare(b.next!.dueOn))[0]
  return open?.next ? { name: open.name, dueOn: open.next.dueOn } : null
})

const show = computed(() => props.items.length > 0 || store.items.length > 0)

function cadenceOf(itemId: string) {
  return store.byId.get(itemId)?.cadence ?? 'MONTHLY'
}

function open(it: ComingUpItem) {
  emit('open', it.itemId, {
    dueOn: it.dueOn,
    state: it.state,
    paidOn: it.paidOn,
    transactionId: it.transactionId,
    daysUntil: it.daysUntil,
  })
}
</script>

<template>
  <section v-if="show" class="neu-3 card" aria-labelledby="coming-up-h">
    <div class="head">
      <h2 id="coming-up-h">{{ t('recurring.comingUp') }}</h2>
      <NuxtLink class="vv-link see-all" to="/you/recurring">{{ t('home.seeAll') }}</NuxtLink>
    </div>

    <ul v-if="items.length" class="recurring-list">
      <RecurringRow
        v-for="it in items"
        :key="`${it.itemId}-${it.dueOn}`"
        :name="it.name"
        :direction="it.direction"
        :cadence="cadenceOf(it.itemId)"
        :state="it.state"
        :occ="{ dueOn: it.dueOn, state: it.state, paidOn: it.paidOn, transactionId: it.transactionId, daysUntil: it.daysUntil }"
        :amount-min-cents="it.expectedMinCents"
        :amount-max-cents="it.expectedMaxCents"
        @open="open(it)"
      />
    </ul>

    <div v-else class="calm">
      <p class="calm-line"><Check :size="16" :stroke-width="2.6" aria-hidden="true" /> <b>{{ t('recurring.nothingDue') }}</b></p>
      <p v-if="nextBill" class="calm-hint">{{ t('recurring.nextUp', { name: nextBill.name, date: shortDate(nextBill.dueOn) }) }}</p>
    </div>
  </section>
</template>

<style scoped>
.card { padding: 16px 16px 6px; margin-bottom: 18px; }
.head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 4px; }
h2 { margin: 0; font-size: 16px; font-weight: 800; }
.see-all { font-size: 14px; display: inline-flex; align-items: center; min-height: 44px; }
.recurring-list { list-style: none; margin: 0; padding: 0; }
.calm { padding: 4px 0 14px; }
.calm p { margin: 0; }
.calm-line { display: flex; align-items: center; gap: 8px; font-size: 14px; }
.calm-line > svg { color: var(--vv-accent); flex: none; }
.calm-hint { margin-top: 6px; font-size: 13px; color: var(--vv-muted); }
</style>
