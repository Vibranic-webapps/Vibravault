<script setup lang="ts">
import { extractMerchant } from '~~/shared/utils/merchant'
import type { Transaction } from '~/stores/transactions'
import { useCategoriesStore } from '~/stores/categories'
import { useRulesStore } from '~/stores/rules'

/**
 * "Teach the app" - the single gesture that is both RENAME and BULK
 * CATEGORISE: pick what to look for, give it a name and/or a category, and it
 * applies to every past row still uncategorised and to every future import.
 */
const props = defineProps<{ transaction: Transaction | null }>()
const emit = defineEmits<{ close: []; saved: [categorised: number] }>()

const categories = useCategoriesStore()
const rules = useRulesStore()

const form = reactive({ match: '', label: '', categoryId: '', applyToExisting: true })
const saving = ref(false)

// Pre-fill the match with the most useful guess: what the extractor found,
// else the bank's name. The user edits it down to the stable part.
watch(() => props.transaction, (t) => {
  if (!t) return
  const guess = extractMerchant(t.description ?? '') ?? t.counterparty ?? ''
  Object.assign(form, { match: guess, label: '', categoryId: t.categoryId ?? '', applyToExisting: true })
  rules.error = null
}, { immediate: true })

const matchTooShort = computed(() => form.match.replace(/\s+/g, ' ').trim().length < 3)
const nothingToDo = computed(() => !form.label.trim() && !form.categoryId)

async function save() {
  saving.value = true
  const n = await rules.create({
    match: form.match,
    label: form.label.trim() || null,
    categoryId: form.categoryId || null,
    applyToExisting: form.applyToExisting,
  })
  saving.value = false
  if (n !== null) emit('saved', n)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="transaction" class="overlay" @click.self="emit('close')">
      <div class="neu-3 form" role="dialog" aria-modal="true" aria-label="Teach a rule">
        <h2>Teach Vibravault</h2>
        <p class="lead">Every transaction containing this text — past and future — follows the rule.</p>

        <p v-if="rules.error" class="vv-error">{{ rules.error }}</p>

        <label class="vv-label" for="r-match">When the bank text contains</label>
        <input id="r-match" v-model="form.match" class="vv-field" maxlength="80" />
        <p class="hint">
          Keep only the stable part — drop dates, times and codes that change every time.
          <span v-if="matchTooShort" class="warn">At least 3 characters.</span>
        </p>

        <label class="vv-label spaced" for="r-label">Call it</label>
        <input id="r-label" v-model="form.label" class="vv-field" maxlength="40" placeholder="e.g. Apple" />

        <label class="vv-label spaced" for="r-cat">File it under</label>
        <select id="r-cat" v-model="form.categoryId" class="vv-field">
          <option value="">Don't change the category</option>
          <optgroup label="Expenses">
            <option v-for="c in categories.expense" :key="c.id" :value="c.id">{{ c.icon }} {{ c.name }}</option>
          </optgroup>
          <optgroup label="Income">
            <option v-for="c in categories.income" :key="c.id" :value="c.id">{{ c.icon }} {{ c.name }}</option>
          </optgroup>
          <optgroup label="Transfers">
            <option v-for="c in categories.transfer" :key="c.id" :value="c.id">{{ c.icon }} {{ c.name }}</option>
          </optgroup>
        </select>

        <label v-if="form.categoryId" class="check spaced">
          <input v-model="form.applyToExisting" type="checkbox" class="box" />
          <span>Also file past transactions that are still uncategorised</span>
        </label>
        <p v-if="form.categoryId" class="hint">Transactions you already categorised by hand are never changed.</p>

        <div class="actions">
          <button class="vv-btn vv-btn--ghost" type="button" @click="emit('close')">Cancel</button>
          <button class="vv-btn" type="button" :disabled="saving || matchTooShort || nothingToDo" @click="save">
            {{ saving ? 'Saving…' : 'Save rule' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 60; display: grid; place-items: center;
  padding: 24px; background: rgba(0, 0, 0, .38); backdrop-filter: blur(2px); overflow-y: auto;
}
.form { width: 100%; max-width: 460px; padding: 28px; }
h2 { margin: 0 0 4px; font-size: 20px; }
.lead { margin: 0 0 20px; font-size: 13px; color: var(--vv-muted); }
.hint { margin: 7px 0 0; font-size: 12px; color: var(--vv-muted-2); }
.warn { color: var(--vv-negative); font-weight: 600; }
.spaced { margin-top: 16px; }

.check { display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--vv-muted); }
.box {
  appearance: none; -webkit-appearance: none;
  position: relative; width: 22px; height: 22px; flex: none; margin: 0;
  border: none; border-radius: 8px; background: var(--vv-surface); box-shadow: var(--vv-p1); cursor: pointer;
}
.box:checked { background: var(--vv-accent); box-shadow: var(--vv-e1); }
.box:checked::after {
  content: ''; position: absolute; left: 7px; top: 3px; width: 5px; height: 10px;
  border: solid var(--vv-accent-text); border-width: 0 2px 2px 0; transform: rotate(45deg);
}
.box:focus-visible { box-shadow: var(--vv-p1), 0 0 0 2px var(--vv-accent-ring); }

.actions { display: flex; gap: 10px; margin-top: 24px; }
</style>
