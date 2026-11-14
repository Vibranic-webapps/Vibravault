<script setup lang="ts">
import { goalProgress } from '~~/shared/goals'
import { centsToInput } from '~~/shared/utils/money'
import {
  useGoalsStore, parseEuroToCents, goalErrorMessage, GOAL_LIMITS, type Goal,
} from '~/stores/goals'

/**
 * Create or edit a savings goal, in a bottom sheet:
 *   name · target amount · optional due date · live "you'd need X a week" line.
 *
 * `goal` = null -> new; an object -> edit that one (only changed fields are sent).
 * The preview uses the SAME math as the server (shared/goals), so what you
 * see while typing is what the card will say after saving.
 */
const props = defineProps<{ open: boolean; goal: Goal | null }>()
const emit = defineEmits<{ close: []; saved: [goal: Goal] }>()

const i18n = useI18n()
const { t } = i18n
const { money } = useFormat()
const { toast } = useToast()
const store = useGoalsStore()

const name = ref('')
const target = ref('')
const due = ref('')
const saving = ref(false)
const formEl = ref<HTMLFormElement | null>(null)

type FieldKey = 'name' | 'targetCents' | 'dueDate'
const errors = reactive<Record<FieldKey, string>>({ name: '', targetCents: '', dueDate: '' })
const formError = ref('')

function clearErrors() {
  errors.name = errors.targetCents = errors.dueDate = ''
  formError.value = ''
}

// Fresh values every time it opens: the goal's own, or empty.
watch(() => props.open, (isOpen) => {
  if (!isOpen) return
  const g = props.goal
  name.value = g?.name ?? ''
  target.value = g ? centsToInput(g.targetCents) : ''
  due.value = g?.dueDate ?? ''
  clearErrors()
})

const open = computed({
  get: () => props.open,
  set: (v: boolean) => { if (!v) emit('close') },
})

// ---- Live preview ------------------------------------------------------------
const targetCents = computed(() => parseEuroToCents(target.value))

const preview = computed(() => {
  if (!targetCents.value || targetCents.value > GOAL_LIMITS.maxCents) return ''
  if (!due.value) return t('goals.previewNoDate')
  const p = goalProgress({
    targetCents: targetCents.value,
    savedCents: props.goal?.savedCents ?? 0,
    dueDate: due.value,
  })
  if (p.isReached) return t('goals.previewReached')
  if (p.isOverdue) return t('goals.previewOverdue')
  if (p.neededPerWeekCents !== null && p.weeksLeft !== null) {
    return t('goals.previewNeed', { amount: money(p.neededPerWeekCents), n: p.weeksLeft }, p.weeksLeft)
  }
  return ''
})

// ---- Save ----------------------------------------------------------------------
function focusFirstInvalid() {
  nextTick(() => formEl.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
}

function validate(): boolean {
  clearErrors()
  if (!name.value.trim()) errors.name = t('goals.err.GOAL_NAME_REQUIRED')
  else if (name.value.trim().length > GOAL_LIMITS.nameMax) errors.name = t('goals.err.GOAL_NAME_TOO_LONG', { nameMax: GOAL_LIMITS.nameMax })
  if (targetCents.value === null || targetCents.value < 1) errors.targetCents = t('goals.err.GOAL_TARGET_INVALID')
  else if (targetCents.value > GOAL_LIMITS.maxCents) errors.targetCents = t('goals.err.GOAL_TARGET_TOO_LARGE')
  const ok = !errors.name && !errors.targetCents
  if (!ok) focusFirstInvalid()
  return ok
}

async function save() {
  if (saving.value || !validate()) return
  const g = props.goal
  const nextName = name.value.trim()
  const nextTarget = targetCents.value!
  const nextDue = due.value || null

  saving.value = true
  let result: Goal | null = null
  if (!g) {
    result = await store.create({ name: nextName, targetCents: nextTarget, ...(nextDue ? { dueDate: nextDue } : {}) })
  } else {
    // PATCH only what changed (an empty PATCH is an error); dueDate null clears the deadline.
    const patch: { name?: string; targetCents?: number; dueDate?: string | null } = {}
    if (nextName !== g.name) patch.name = nextName
    if (nextTarget !== g.targetCents) patch.targetCents = nextTarget
    if (nextDue !== g.dueDate) patch.dueDate = nextDue
    if (!Object.keys(patch).length) { saving.value = false; emit('close'); return }
    result = await store.update(g.id, patch)
  }
  saving.value = false

  if (!result) {
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
  toast(g ? t('toast.saved') : t('goals.created'))
  emit('saved', result)
  emit('close')
}
</script>

<template>
  <UiBottomSheet v-model="open" :title="goal ? t('goals.edit') : t('goals.new')">
    <form ref="formEl" class="form" novalidate @submit.prevent="save">
      <p v-if="formError" class="vv-error" role="alert">{{ formError }}</p>

      <UiField
        v-model="name"
        :label="t('goals.name')"
        :placeholder="t('goals.namePh')"
        :maxlength="GOAL_LIMITS.nameMax"
        :error="errors.name"
        autocomplete="off"
      />

      <UiField
        v-model="target"
        :label="t('goals.target')"
        prefix="€"
        size="lg"
        inputmode="decimal"
        placeholder="0,00"
        autocomplete="off"
        :error="errors.targetCents"
      />

      <div class="due">
        <UiField
          v-model="due"
          type="date"
          :label="t('goals.due')"
          :hint="t('goals.dueHint')"
          :error="errors.dueDate"
        />
        <!-- iOS date pickers have no way to empty the field again. -->
        <UiButton v-if="due" variant="ghost" :block="false" @click="due = ''">{{ t('goals.clearDue') }}</UiButton>
      </div>

      <p class="preview" aria-live="polite">{{ preview }}</p>

      <UiButton type="submit" :loading="saving">{{ goal ? t('goals.save') : t('goals.create') }}</UiButton>
    </form>
  </UiBottomSheet>
</template>

<style scoped>
.form { display: grid; gap: 20px; }
.due { display: grid; gap: 10px; justify-items: start; }
.due :deep(.field) { justify-self: stretch; width: 100%; }
.preview { margin: 0; min-height: 1.4em; font-size: 14px; line-height: 1.45; color: var(--vv-muted); font-variant-numeric: tabular-nums; }
</style>
