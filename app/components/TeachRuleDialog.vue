<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import { extractMerchant } from '~~/shared/utils/merchant'
import type { Transaction } from '~/stores/transactions'
import { useRulesStore } from '~/stores/rules'

/**
 * "Rename & sort all like this" - the single gesture that is both RENAME and
 * BULK SORT: pick the bank text to look for, give it a name and/or a
 * category, and it applies to every future import and (optionally) to past
 * transactions that aren't sorted yet. In a bottom sheet, with category
 * TILES like everywhere else.
 */
const props = defineProps<{ transaction: Transaction | null }>()
const emit = defineEmits<{ close: []; saved: [categorised: number] }>()

const { t } = useI18n()
const rules = useRulesStore()

const match = ref('')
const label = ref('')
const categoryId = ref<string | null>(null)
const applyToExisting = ref(true)
const saving = ref(false)
const error = ref('')

// Keep showing the last transaction while the sheet animates out.
const shown = ref<Transaction | null>(props.transaction)
const direction = computed<'in' | 'out'>(() => ((shown.value?.amountCents ?? 0) > 0 ? 'in' : 'out'))

// Pre-fill the match with the most useful guess: what the extractor found,
// else the bank's name. You edit it down to the part that never changes.
watch(() => props.transaction, (tx) => {
  if (!tx) return
  shown.value = tx
  match.value = extractMerchant(tx.description ?? '') ?? tx.counterparty ?? ''
  label.value = ''
  categoryId.value = tx.categoryId
  applyToExisting.value = true
  error.value = ''
}, { immediate: true })

const open = computed({
  get: () => !!props.transaction,
  set: (v: boolean) => { if (!v) emit('close') },
})

const matchTooShort = computed(() => match.value.replace(/\s+/g, ' ').trim().length < 3)
const nothingToDo = computed(() => !label.value.trim() && !categoryId.value)

async function save() {
  if (saving.value || matchTooShort.value) return
  if (nothingToDo.value) { error.value = t('teach.nothing'); return }
  error.value = ''
  saving.value = true
  const n = await rules.create({
    match: match.value,
    label: label.value.trim() || null,
    categoryId: categoryId.value,
    applyToExisting: applyToExisting.value,
  })
  saving.value = false
  if (n === null) { error.value = t('drawer.couldNotSave'); return }
  emit('saved', n)
}
</script>

<template>
  <UiBottomSheet v-model="open" :title="t('teach.title')">
    <form class="form" @submit.prevent="save">
      <p class="lead">{{ t('teach.lead') }}</p>

      <UiField
        v-model="match"
        :label="t('teach.match')"
        :hint="t('teach.matchHint')"
        :error="matchTooShort ? t('teach.tooShort') : ''"
        :maxlength="80"
        autocomplete="off"
      />

      <UiField v-model="label" :label="t('teach.label')" :placeholder="t('teach.labelPh')" :maxlength="40" autocomplete="off" />

      <div>
        <p class="label">{{ t('teach.category') }}</p>
        <CategoryPicker v-model="categoryId" :direction="direction" :none-label="t('teach.keepCategory')" />
      </div>

      <label v-if="categoryId" class="check">
        <input v-model="applyToExisting" type="checkbox" class="sr" />
        <span class="box" aria-hidden="true"><Check v-if="applyToExisting" :size="15" :stroke-width="3" /></span>
        <span>
          {{ t('teach.applyPast') }}
          <small>{{ t('teach.applyHint') }}</small>
        </span>
      </label>

      <p v-if="error" class="vv-error" role="alert">{{ error }}</p>

      <UiButton type="submit" :loading="saving" :disabled="matchTooShort">{{ t('teach.save') }}</UiButton>
    </form>
  </UiBottomSheet>
</template>

<style scoped>
.form { display: grid; gap: 20px; }
.lead { margin: 0; font-size: 14px; line-height: 1.5; color: var(--vv-muted); }
.label { margin: 0 0 10px; font-size: 13px; font-weight: 700; color: var(--vv-muted); }

.check { display: flex; align-items: flex-start; gap: 12px; cursor: pointer; font-size: 14px; font-weight: 600; }
.check small { display: block; margin-top: 3px; font-size: 12px; font-weight: 400; color: var(--vv-muted); }
.sr { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.box {
  display: grid; place-items: center; width: 26px; height: 26px; flex: none;
  color: var(--vv-accent-text); background: var(--vv-surface);
  border-radius: 8px; box-shadow: var(--vv-p1);
}
.sr:checked + .box { background: var(--vv-accent); box-shadow: var(--vv-e1); }
.sr:focus-visible + .box { outline: 2px solid var(--vv-accent-ring); outline-offset: 2px; }
</style>
