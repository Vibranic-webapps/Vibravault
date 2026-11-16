<script setup lang="ts">
import { ArrowDown, ArrowUp } from 'lucide-vue-next'
import { parseAmountToCents, centsToInput } from '~~/shared/utils/money'
import {
  useRecurringStore,
  type RecurringCadence,
  type RecurringDirection,
  type RecurringInput,
  type RecurringItem,
} from '~/stores/recurring'
import { useCategoriesStore } from '~/stores/categories'
import { CADENCE_OPTIONS } from './recurringText'

/**
 * Add / edit a recurring bill or income, in a bottom sheet.
 *   - `item` given  -> edit it
 *   - `prefill`     -> a new one, started from something else (e.g. a transaction: "Repeats...")
 *   - neither       -> a blank new one
 *
 * Amount is typed as text and parsed to integer cents (no float maths), the same
 * way the rule dialog does it. Positive numbers only: the direction carries the sign.
 * The server's answer is shown by field/code, and what you typed is kept on error.
 */
export interface RecurringPrefill {
  name?: string
  match?: string
  amountCents?: number
  direction?: RecurringDirection
  anchorOn?: string
  cadence?: RecurringCadence
  categoryId?: string | null
}

const NAME_MAX = 40
const MATCH_MIN = 3
const MATCH_MAX = 80

const props = defineProps<{
  modelValue: boolean
  item?: RecurringItem | null
  prefill?: RecurringPrefill | null
}>()
const emit = defineEmits<{ 'update:modelValue': [open: boolean]; saved: [item: RecurringItem] }>()

const { t, te } = useI18n()
const { toast } = useToast()
const store = useRecurringStore()
const categories = useCategoriesStore()

const editing = computed(() => !!props.item)

// ---- Form state -----------------------------------------------------------
const direction = ref<RecurringDirection>('OUT')
const name = ref('')
const match = ref('')
const matchTouched = ref(false) // once you edit the bank text yourself, we stop copying the name into it
const amountText = ref('')
const varies = ref(false)
const minText = ref('')
const maxText = ref('')
const cadence = ref<RecurringCadence>('MONTHLY')
const dueOn = ref('')
const initialDueOn = ref('')
const categoryId = ref<string | null>(null)
const paused = ref(false)

const tried = ref(false)
const saving = ref(false)
const serverError = ref<{ field: string | null; text: string } | null>(null)
const form = ref<HTMLFormElement | null>(null)

/** Today as a day key; the server's Brussels date when we have it, else this device's. */
function todayKey(): string {
  if (store.today) return store.today
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function reset() {
  tried.value = false
  serverError.value = null
  const it = props.item
  const pre = props.prefill
  if (it) {
    direction.value = it.direction
    name.value = it.name
    match.value = it.match
    matchTouched.value = true
    varies.value = it.amountMinCents !== it.amountMaxCents
    amountText.value = centsToInput(it.amountMinCents)
    minText.value = centsToInput(it.amountMinCents)
    maxText.value = centsToInput(it.amountMaxCents)
    cadence.value = it.cadence
    // Show the date it is due next; only send it back if you change it (the cycle is anchored on anchorOn).
    initialDueOn.value = it.next?.dueOn ?? it.anchorOn
    dueOn.value = initialDueOn.value
    categoryId.value = it.categoryId
    paused.value = !it.active
  } else {
    direction.value = pre?.direction ?? 'OUT'
    name.value = pre?.name ?? ''
    match.value = pre?.match ?? ''
    matchTouched.value = !!pre?.match
    varies.value = false
    amountText.value = pre?.amountCents ? centsToInput(pre.amountCents) : ''
    minText.value = ''
    maxText.value = ''
    cadence.value = pre?.cadence ?? 'MONTHLY'
    initialDueOn.value = ''
    dueOn.value = pre?.anchorOn ?? todayKey()
    // A prefilled category must fit the direction (a Transfer category never does): the server would refuse it.
    const preKind = pre?.categoryId ? categories.byId.get(pre.categoryId)?.kind : null
    categoryId.value = preKind === (direction.value === 'IN' ? 'INCOME' : 'EXPENSE') ? (pre?.categoryId ?? null) : null
    paused.value = false
  }
}
watch(() => props.modelValue, (open) => { if (open) reset() }, { immediate: true })

// Until you type your own bank text, it follows the name (most bills are named after their bank text).
watch(name, (n) => { if (!matchTouched.value && !editing.value) match.value = n })

// A category only fits one direction; drop it when the direction flips so the server never refuses it.
watch(direction, (d) => {
  const kind = categoryId.value ? categories.byId.get(categoryId.value)?.kind : null
  if ((d === 'IN' && kind === 'EXPENSE') || (d === 'OUT' && kind === 'INCOME')) categoryId.value = null
})

// ---- Validation (before sending) --------------------------------------------
function cents(text: string): number | null {
  const c = parseAmountToCents(text)
  return c === null || c === 0 ? null : Math.abs(c)
}
const fixedCents = computed(() => cents(amountText.value))
const minCents = computed(() => cents(minText.value))
const maxCents = computed(() => cents(maxText.value))

const errors = computed(() => {
  const e: Record<string, string> = {}
  const n = name.value.trim()
  if (!n) e.name = t('recurring.form.errName')
  else if (n.length > NAME_MAX) e.name = t('recurring.form.errNameLong', { max: NAME_MAX })
  const m = match.value.replace(/\s+/g, ' ').trim()
  if (m.length < MATCH_MIN) e.match = t('recurring.form.errMatch', { min: MATCH_MIN })
  else if (m.length > MATCH_MAX) e.match = t('recurring.form.errMatchLong', { max: MATCH_MAX })
  if (varies.value) {
    if (minCents.value === null) e.min = t('recurring.form.errAmount')
    if (maxCents.value === null) e.max = t('recurring.form.errAmount')
    else if (minCents.value !== null && maxCents.value < minCents.value) e.max = t('recurring.form.errRange')
  } else if (fixedCents.value === null) {
    e.amount = t('recurring.form.errAmount')
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueOn.value)) e.dueOn = t('recurring.form.errDate')
  return e
})

/** Shown error for a field: ours once you tried to save, or the server's for that field. */
function fieldError(key: string, serverFields: string[] = [key]): string {
  if (tried.value && errors.value[key]) return errors.value[key]
  const s = serverError.value
  return s && s.field && serverFields.includes(s.field) ? s.text : ''
}
// Server fields: amountMinCents / amountMaxCents belong to whichever amount field is on screen.
const amountServerFields = computed(() => ['amountMinCents', 'amountMaxCents'])
const generalError = computed(() => {
  const s = serverError.value
  if (!s) return ''
  const known = ['name', 'match', 'amountMinCents', 'amountMaxCents', 'anchorOn', 'categoryId']
  return s.field && known.includes(s.field) ? '' : s.text
})

function errorText(code: string | null): string {
  const key = code ? `recurring.error.${code}` : ''
  return key && te(key) ? t(key) : t('recurring.error.generic')
}

// ---- Save -------------------------------------------------------------------
async function save() {
  if (saving.value) return
  tried.value = true
  serverError.value = null
  if (Object.keys(errors.value).length) {
    await nextTick()
    form.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    return
  }

  const min = varies.value ? minCents.value! : fixedCents.value!
  const max = varies.value ? maxCents.value! : fixedCents.value!
  const body: RecurringInput = {
    name: name.value.trim(),
    match: match.value.replace(/\s+/g, ' ').trim(),
    amountMinCents: min,
    amountMaxCents: max,
    direction: direction.value,
    cadence: cadence.value,
    anchorOn: dueOn.value,
    categoryId: categoryId.value,
  }

  saving.value = true
  let saved: RecurringItem | null
  if (props.item) {
    const patch: Partial<RecurringInput> = { ...body, active: !paused.value }
    // Leave the cycle anchor alone unless you moved the date (see reset()).
    if (dueOn.value === initialDueOn.value) delete patch.anchorOn
    saved = await store.update(props.item.id, patch)
  } else {
    saved = await store.create(body)
  }
  saving.value = false

  if (!saved) {
    const f = store.failure
    serverError.value = { field: f?.field ?? null, text: errorText(f?.code ?? null) }
    await nextTick()
    form.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    return
  }
  toast(editing.value ? t('recurring.toast.saved') : t('recurring.toast.added', { name: saved.name }))
  emit('saved', saved)
  emit('update:modelValue', false)
}

const directionOptions = computed(() => [
  { value: 'OUT', label: t('recurring.kindOut'), icon: ArrowUp },
  { value: 'IN', label: t('recurring.kindIn'), icon: ArrowDown },
])
const cadenceOptions = computed(() =>
  CADENCE_OPTIONS.map((c) => ({ value: c, label: t(`recurring.cadence.${c}`) })),
)
const pickerDirection = computed<'in' | 'out'>(() => (direction.value === 'IN' ? 'in' : 'out'))
</script>

<template>
  <UiBottomSheet
    :model-value="modelValue"
    :title="editing ? t('recurring.form.editTitle') : t('recurring.form.addTitle')"
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <form ref="form" class="form" novalidate @submit.prevent="save">
      <UiSegmented v-model="direction" :label="t('recurring.form.kind')" :options="directionOptions" />

      <UiField
        v-model="name"
        :label="t('recurring.form.name')"
        :placeholder="t('recurring.form.namePh')"
        :error="fieldError('name')"
        :maxlength="NAME_MAX"
        autocomplete="off"
      />

      <!-- Amount: one number, or a range for bills that change every month. -->
      <div class="amount">
        <UiField
          v-if="!varies"
          v-model="amountText"
          :label="t('recurring.form.amount')"
          :error="fieldError('amount', amountServerFields)"
          prefix="€"
          inputmode="decimal"
          :maxlength="12"
          autocomplete="off"
        />
        <div v-else class="range">
          <UiField
            v-model="minText"
            :label="t('recurring.form.min')"
            :error="fieldError('min', amountServerFields)"
            prefix="€"
            inputmode="decimal"
            :maxlength="12"
            autocomplete="off"
          />
          <UiField
            v-model="maxText"
            :label="t('recurring.form.max')"
            :error="fieldError('max', amountServerFields)"
            prefix="€"
            inputmode="decimal"
            :maxlength="12"
            autocomplete="off"
          />
        </div>
        <UiCheckbox v-model="varies">
          {{ t('recurring.form.varies') }}
          <small>{{ t('recurring.form.variesHint') }}</small>
        </UiCheckbox>
      </div>

      <UiField
        v-model="match"
        :label="t('recurring.form.match')"
        :hint="t('recurring.form.matchHint')"
        :error="fieldError('match')"
        :maxlength="MATCH_MAX"
        autocomplete="off"
        @update:model-value="matchTouched = true"
      />

      <UiField v-model="cadence" as="select" :label="t('recurring.form.cadence')" :options="cadenceOptions" />

      <UiField
        v-model="dueOn"
        type="date"
        :label="editing ? t('recurring.form.dueEdit') : t('recurring.form.due')"
        :hint="t('recurring.form.dueHint')"
        :error="fieldError('dueOn', ['anchorOn'])"
      />

      <div>
        <p class="label">{{ t('recurring.form.category') }}</p>
        <CategoryPicker v-model="categoryId" :direction="pickerDirection" :none-label="t('recurring.form.noCategory')" />
        <p v-if="fieldError('category', ['categoryId'])" class="vv-error" role="alert">{{ fieldError('category', ['categoryId']) }}</p>
      </div>

      <UiCheckbox v-if="editing" v-model="paused">
        {{ t('recurring.form.paused') }}
        <small>{{ t('recurring.form.pausedHint') }}</small>
      </UiCheckbox>

      <p v-if="generalError" class="vv-error" role="alert">{{ generalError }}</p>

      <UiButton type="submit" :loading="saving">{{ editing ? t('common.save') : t('recurring.form.add') }}</UiButton>
    </form>
  </UiBottomSheet>
</template>

<style scoped>
.form { display: grid; gap: 20px; }
.amount { display: grid; gap: 14px; }
.range { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.label { margin: 0 0 10px; font-size: 13px; font-weight: 700; color: var(--vv-muted); }
</style>
