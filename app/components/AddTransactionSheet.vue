<script setup lang="ts">
import { useTransactionsStore, dayKey } from '~/stores/transactions'
import { useCategoriesStore } from '~/stores/categories'

/**
 * "New transaction", rethought (#7). In the order you actually think it:
 *   1. money in or out?      - one tap, defaults to out (most rows are)
 *   2. how much?             - big, first, number keyboard
 *   3. who or what?
 *   4. category              - tiles, not a dropdown
 *   5. when?                 - Today / Yesterday / Other day (no calendar
 *                              unless you actually need one)
 *   6. note                  - optional, last
 */
const { open } = useAddTransaction()
const { t } = useI18n()
const { toast } = useToast()
const txStore = useTransactionsStore()
const categories = useCategoriesStore()

type When = 'today' | 'yesterday' | 'other'

const direction = ref<'out' | 'in'>('out')
const amount = ref('')
const name = ref('')
const categoryId = ref<string | null>(null)
const when = ref<When>('today')
const otherDate = ref(dayKey(new Date()))
const note = ref('')
const error = ref('')
const saving = ref(false)

function reset() {
  direction.value = 'out'
  amount.value = ''
  name.value = ''
  categoryId.value = null
  when.value = 'today'
  otherDate.value = dayKey(new Date())
  note.value = ''
  error.value = ''
}

// Fresh form every time it opens; categories loaded if nobody did yet.
watch(open, (isOpen) => {
  if (!isOpen) return
  reset()
  categories.fetchAll()
})

// Switching in/out: a spending category can't stay on money in (and the
// other way round). Transfers fit both, so those survive the switch.
watch(direction, () => {
  const c = categoryId.value ? categories.byId.get(categoryId.value) : undefined
  if (c && c.kind !== 'TRANSFER') categoryId.value = null
})

const bookedAt = computed(() => {
  if (when.value === 'other') return otherDate.value
  const d = new Date()
  if (when.value === 'yesterday') d.setDate(d.getDate() - 1)
  return dayKey(d)
})

async function save() {
  if (saving.value) return
  const clean = amount.value.trim().replace(/^[-+−]/, '')
  if (!clean) { error.value = t('drawer.enterAmount'); return }
  if (!bookedAt.value) { error.value = t('drawer.pickDate'); return }

  error.value = ''
  saving.value = true
  const ok = await txStore.create({
    // The sign comes from the toggle, in ONE place - you never type a minus.
    amount: direction.value === 'out' ? `-${clean}` : clean,
    bookedAt: bookedAt.value,
    categoryId: categoryId.value,
    counterparty: name.value.trim() || null,
    description: note.value.trim() || null,
  })
  saving.value = false

  if (!ok) { error.value = txStore.error ?? t('drawer.couldNotSave'); return }
  open.value = false
  toast(t('addForm.saved'))
  // Home's numbers come from their own request - tell it to refetch.
  refreshNuxtData('dashboard')
}
</script>

<template>
  <UiBottomSheet v-model="open" :title="t('addForm.title')">
    <form class="form" @submit.prevent="save">
      <UiSegmented
        v-model="direction"
        :label="t('addForm.direction')"
        :options="[{ value: 'out', label: t('addForm.out') }, { value: 'in', label: t('addForm.in') }]"
      />

      <UiField
        v-model="amount"
        :label="t('addForm.amount')"
        :prefix="direction === 'out' ? '−€' : '+€'"
        inputmode="decimal"
        placeholder="0,00"
        size="lg"
        autocomplete="off"
        :error="error && !amount.trim() ? error : ''"
        @enter="save"
      />

      <UiField
        v-model="name"
        :label="t('addForm.name')"
        :placeholder="t('addForm.namePh')"
        :maxlength="120"
        autocomplete="off"
        @enter="save"
      />

      <div>
        <p class="label">{{ t('addForm.category') }}</p>
        <CategoryPicker v-model="categoryId" :direction="direction" />
      </div>

      <div>
        <p class="label">{{ t('addForm.when') }}</p>
        <div class="when">
          <UiChip :active="when === 'today'" @click="when = 'today'">{{ t('addForm.today') }}</UiChip>
          <UiChip :active="when === 'yesterday'" @click="when = 'yesterday'">{{ t('addForm.yesterday') }}</UiChip>
          <UiChip :active="when === 'other'" @click="when = 'other'">{{ t('addForm.otherDay') }}</UiChip>
        </div>
        <UiField v-if="when === 'other'" v-model="otherDate" class="other" :label="t('drawer.date')" type="date" />
      </div>

      <UiField v-model="note" :label="t('addForm.note')" :placeholder="t('common.optional')" :maxlength="500" @enter="save" />

      <p v-if="error && amount.trim()" class="vv-error" role="alert">{{ error }}</p>

      <UiButton type="submit" :loading="saving">{{ t('addForm.save') }}</UiButton>
    </form>
  </UiBottomSheet>
</template>

<style scoped>
.form { display: grid; gap: 20px; }
.label { margin: 0 0 10px; font-size: 13px; font-weight: 700; color: var(--vv-muted); }
.when { display: flex; flex-wrap: wrap; gap: 8px; }
.other { margin-top: 12px; }
</style>
