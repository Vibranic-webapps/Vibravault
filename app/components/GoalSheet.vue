<script setup lang="ts">
import { goalProgress } from '~~/shared/goals'
import { centsToInput } from '~~/shared/utils/money'
import { ImagePlus, Link2, Trash2 } from 'lucide-vue-next'
import {
  useGoalsStore, parseEuroToCents, goalErrorMessage, GOAL_LIMITS, type Goal, type GoalInput,
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

// The look: a pastel tint and an optional picture (a small upload, or a pasted https link).
const tint = ref<string | null>(null)
const pendingImage = ref<string | null>(null) // a freshly picked photo, already shrunk (data URL)
const linkOpen = ref(false)
const link = ref('')
const removed = ref(false) // the user took the current picture away
const fileEl = ref<HTMLInputElement | null>(null)

type FieldKey = 'name' | 'targetCents' | 'dueDate' | 'image' | 'imageUrl'
const errors = reactive<Record<FieldKey, string>>({ name: '', targetCents: '', dueDate: '', image: '', imageUrl: '' })
const formError = ref('')

function clearErrors() {
  errors.name = errors.targetCents = errors.dueDate = errors.image = errors.imageUrl = ''
  formError.value = ''
}

// Fresh values every time it opens: the goal's own, or empty.
watch(() => props.open, (isOpen) => {
  if (!isOpen) return
  const g = props.goal
  name.value = g?.name ?? ''
  target.value = g ? centsToInput(g.targetCents) : ''
  due.value = g?.dueDate ?? ''
  // A new goal starts on the next tint in turn, so a row of goals is not one colour.
  tint.value = g ? g.tint : GOAL_TINTS[store.items.length % GOAL_TINTS.length]!
  pendingImage.value = null
  link.value = ''
  linkOpen.value = false
  removed.value = false
  clearErrors()
})

const open = computed({
  get: () => props.open,
  set: (v: boolean) => { if (!v) emit('close') },
})

// ---- Picture ---------------------------------------------------------------------
const shownTint = computed(() => goalTint({ id: props.goal?.id ?? '', tint: tint.value }))
const linkOk = computed(() => /^https:\/\/\S+$/i.test(link.value.trim()))
const previewSrc = computed(() => {
  if (pendingImage.value) return pendingImage.value
  if (linkOpen.value && linkOk.value) return link.value.trim()
  return removed.value ? null : (props.goal?.imageSrc ?? null)
})
const hasPicture = computed(() => !!previewSrc.value)

async function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // picking the same file again must still fire
  if (!file) return
  errors.image = ''
  try {
    pendingImage.value = await shrinkImage(file)
    link.value = ''
    linkOpen.value = false
    removed.value = false
  } catch (err) {
    errors.image = t(err instanceof Error && err.message === 'too-big' ? 'goals.err.GOAL_IMAGE_TOO_LARGE' : 'goals.err.GOAL_IMAGE_INVALID')
  }
}
function removePicture() {
  pendingImage.value = null
  link.value = ''
  linkOpen.value = false
  removed.value = true
  errors.image = errors.imageUrl = ''
}

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
  if (linkOpen.value && link.value.trim() && !linkOk.value) errors.imageUrl = t('goals.err.GOAL_IMAGE_URL_INVALID')
  const ok = !errors.name && !errors.targetCents && !errors.imageUrl
  if (!ok) focusFirstInvalid()
  return ok
}

async function save() {
  if (saving.value || !validate()) return
  const g = props.goal
  const nextName = name.value.trim()
  const nextTarget = targetCents.value!
  const nextDue = due.value || null

  // At most one picture instruction per save: a new upload, a new link, or "remove".
  const look: { image?: string; imageUrl?: string; removeImage?: boolean } = {}
  if (pendingImage.value) look.image = pendingImage.value
  else if (linkOpen.value && linkOk.value && link.value.trim() !== g?.imageSrc) look.imageUrl = link.value.trim()
  else if (removed.value && g?.imageSrc) look.removeImage = true

  saving.value = true
  let result: Goal | null = null
  if (!g) {
    result = await store.create({
      name: nextName, targetCents: nextTarget, ...(nextDue ? { dueDate: nextDue } : {}),
      ...(tint.value ? { tint: tint.value } : {}), ...look,
    })
  } else {
    // PATCH only what changed (an empty PATCH is an error); dueDate null clears the deadline.
    const patch: GoalInput = {}
    if (nextName !== g.name) patch.name = nextName
    if (nextTarget !== g.targetCents) patch.targetCents = nextTarget
    if (nextDue !== g.dueDate) patch.dueDate = nextDue
    if (tint.value !== g.tint) patch.tint = tint.value
    Object.assign(patch, look)
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

      <!-- What you are saving for: a picture on a pastel tint. -->
      <fieldset class="look">
        <legend>{{ t('goals.look') }}</legend>
        <div class="pic-row">
          <div class="pic" :style="goalTintStyle(shownTint)">
            <GoalPicture :src="previewSrc" :name="name || '?'" fit="ambient" />
          </div>
          <div class="pic-actions">
            <UiButton variant="ghost" :block="false" :icon="ImagePlus" @click="fileEl?.click()">
              {{ hasPicture ? t('goals.imageChange') : t('goals.imageAdd') }}
            </UiButton>
            <UiButton v-if="!linkOpen" variant="ghost" :block="false" :icon="Link2" @click="linkOpen = true">{{ t('goals.imageLink') }}</UiButton>
            <UiButton v-if="hasPicture" variant="ghost" :block="false" :icon="Trash2" @click="removePicture">{{ t('goals.imageRemove') }}</UiButton>
          </div>
        </div>
        <input ref="fileEl" class="file" type="file" accept="image/*" tabindex="-1" aria-hidden="true" @change="onPick">
        <p v-if="errors.image" class="vv-error" role="alert">{{ errors.image }}</p>
        <UiField
          v-if="linkOpen"
          v-model="link"
          :label="t('goals.imageLinkLabel')"
          placeholder="https://…"
          autocomplete="off"
          :hint="t('goals.imageLinkHint')"
          :error="errors.imageUrl"
        />
        <div class="swatches" role="radiogroup" :aria-label="t('goals.tint')">
          <button
            v-for="c in GOAL_TINTS"
            :key="c"
            type="button"
            class="swatch"
            :class="{ on: shownTint === c }"
            role="radio"
            :aria-checked="shownTint === c"
            :aria-label="t(`goals.tints.${c}`)"
            :style="goalTintStyle(c)"
            @click="tint = c"
          />
        </div>
      </fieldset>

      <UiButton type="submit" :loading="saving">{{ goal ? t('goals.save') : t('goals.create') }}</UiButton>
    </form>
  </UiBottomSheet>
</template>

<style scoped>
.form { display: grid; gap: 20px; }
.due { display: grid; gap: 10px; justify-items: start; }
.due :deep(.field) { justify-self: stretch; width: 100%; }
.look { display: grid; gap: 14px; margin: 0; padding: 0; border: none; min-width: 0; }
.look legend { padding: 0; margin-bottom: 10px; font-size: 14px; font-weight: 700; color: var(--vv-text); }
.pic-row { display: flex; align-items: center; gap: 14px; }
.pic { flex: none; width: 96px; height: 96px; background: var(--g-bg); border-radius: var(--vv-r-md); box-shadow: var(--vv-p1); overflow: hidden; }
.pic-actions { display: flex; flex-wrap: wrap; gap: 4px 6px; min-width: 0; }
.file { display: none; }
.swatches { display: flex; gap: 14px; }
.swatch { width: 40px; height: 40px; padding: 0; border: none; border-radius: 50%; background: var(--g-bg); box-shadow: var(--vv-e1); cursor: pointer; -webkit-tap-highlight-color: transparent; }
.swatch.on { box-shadow: var(--vv-p2); outline: 3px solid var(--g-ink); outline-offset: 3px; }
.swatch:focus-visible { outline: 2px solid var(--vv-accent-ring); outline-offset: 3px; }
.preview { margin: 0; min-height: 1.4em; font-size: 14px; line-height: 1.45; color: var(--vv-muted); font-variant-numeric: tabular-nums; }
</style>
