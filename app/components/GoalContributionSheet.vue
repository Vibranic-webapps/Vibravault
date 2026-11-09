<script setup lang="ts">
import { brusselsDayKey } from '~~/shared/goals'
import { useGoalsStore, parseEuroToCents, goalErrorMessage, GOAL_LIMITS, type Goal } from '~/stores/goals'

/**
 * Add money to a goal, or take money out of it, in a bottom sheet:
 *   amount · date (today, Brussels) · optional note · "after this" line.
 *
 * The user always types a positive amount; `mode` decides the sign sent to the
 * API (+ saved / - taken out). Taking out more than is saved is blocked here
 * and, as a safety net, by the server (409).
 */
const props = defineProps<{ open: boolean; goal: Goal | null; mode: 'add' | 'take' }>()
const emit = defineEmits<{ close: [] }>()

const i18n = useI18n()
const { t } = i18n
const { money } = useFormat()
const { toast } = useToast()
const store = useGoalsStore()

const amount = ref('')
const day = ref('')
const note = ref('')
const saving = ref(false)
const formEl = ref<HTMLFormElement | null>(null)

type FieldKey = 'amountCents' | 'contributedAt' | 'note'
const errors = reactive<Record<FieldKey, string>>({ amountCents: '', contributedAt: '', note: '' })
const formError = ref('')

function clearErrors() {
  errors.amountCents = errors.contributedAt = errors.note = ''
  formError.value = ''
}

watch(() => props.open, (isOpen) => {
  if (!isOpen) return
  amount.value = ''
  // "Today" is the calendar day in Brussels, not the browser's or the server's.
  day.value = brusselsDayKey(new Date())
  note.value = ''
  clearErrors()
})

const open = computed({
  get: () => props.open,
  set: (v: boolean) => { if (!v) emit('close') },
})

const cents = computed(() => parseEuroToCents(amount.value))
const taking = computed(() => props.mode === 'take')

// What the saved total will be if this goes through.
const afterCents = computed(() => {
  if (!props.goal || !cents.value || cents.value > GOAL_LIMITS.maxCents) return null
  const next = props.goal.savedCents + (taking.value ? -cents.value : cents.value)
  return next < 0 ? null : next
})

function focusFirstInvalid() {
  nextTick(() => formEl.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
}

function validate(): boolean {
  clearErrors()
  const g = props.goal
  if (cents.value === null || cents.value < 1) errors.amountCents = t('goals.err.CONTRIBUTION_AMOUNT_INVALID')
  else if (cents.value > GOAL_LIMITS.maxCents) errors.amountCents = t('goals.err.CONTRIBUTION_AMOUNT_TOO_LARGE')
  else if (taking.value && g && cents.value > g.savedCents) {
    errors.amountCents = t('goals.err.GOAL_WITHDRAWAL_EXCEEDS_SAVED', { saved: money(g.savedCents) })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day.value)) errors.contributedAt = t('goals.err.CONTRIBUTION_DATE_INVALID')
  if (note.value.trim().length > GOAL_LIMITS.noteMax) errors.note = t('goals.err.CONTRIBUTION_NOTE_TOO_LONG', { noteMax: GOAL_LIMITS.noteMax })
  const ok = !errors.amountCents && !errors.contributedAt && !errors.note
  if (!ok) focusFirstInvalid()
  return ok
}

async function save() {
  const g = props.goal
  if (!g || saving.value || !validate()) return
  saving.value = true
  const created = await store.addContribution(g.id, {
    amountCents: taking.value ? -cents.value! : cents.value!,
    contributedAt: day.value,
    ...(note.value.trim() ? { note: note.value.trim() } : {}),
  })
  saving.value = false

  if (!created) {
    const f = store.failure
    const message = f ? goalErrorMessage(f, i18n, money) : t('goals.err.generic')
    const field = f?.field as FieldKey | null | undefined
    if (field && field in errors) {
      errors[field] = message
      focusFirstInvalid()
    } else {
      formError.value = message
    }
    return
  }
  toast(taking.value ? t('goals.takenOut') : t('goals.added'))
  emit('close')
}
</script>

<template>
  <UiBottomSheet v-model="open" :title="taking ? t('goals.takeOut') : t('goals.add')">
    <form ref="formEl" class="form" novalidate @submit.prevent="save">
      <p v-if="goal" class="for">{{ goal.name }}</p>
      <p v-if="formError" class="vv-error" role="alert">{{ formError }}</p>

      <UiField
        v-model="amount"
        :label="t('goals.amount')"
        prefix="€"
        size="lg"
        inputmode="decimal"
        placeholder="0,00"
        autocomplete="off"
        :error="errors.amountCents"
      />
      <UiField v-model="day" type="date" :label="t('goals.date')" :error="errors.contributedAt" />
      <UiField
        v-model="note"
        :label="t('goals.noteOptional')"
        :placeholder="t('goals.notePh')"
        :maxlength="GOAL_LIMITS.noteMax"
        :error="errors.note"
        autocomplete="off"
      />

      <p class="after" aria-live="polite">
        <template v-if="goal && afterCents !== null">
          {{ t('goals.afterThis', { saved: money(afterCents), target: money(goal.targetCents) }) }}
        </template>
      </p>

      <UiButton type="submit" :loading="saving">{{ taking ? t('goals.takeOutSubmit') : t('goals.addSubmit') }}</UiButton>
    </form>
  </UiBottomSheet>
</template>

<style scoped>
.form { display: grid; gap: 20px; }
.for { margin: -6px 0 0; font-size: 14px; color: var(--vv-muted); overflow-wrap: anywhere; }
.after { margin: 0; min-height: 1.4em; font-size: 14px; color: var(--vv-muted); font-variant-numeric: tabular-nums; }
</style>
