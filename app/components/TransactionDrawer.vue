<script setup lang="ts">
import { formatCents, centsToInput } from '~~/shared/utils/money'
import { transactionLabel } from '~~/shared/utils/merchant'
import { useTransactionsStore, type Transaction } from '~/stores/transactions'
import { useCategoriesStore, type Category } from '~/stores/categories'
import { useRulesStore } from '~/stores/rules'

/**
 * Read-first detail view with INLINE editing.
 *
 * Still read-first: every value looks like text until you tap it, so opening
 * a row can't change anything by accident. Tapping a value turns just that
 * value into an input; nothing else on the sheet changes.
 *
 * What is editable depends on WHERE the row came from:
 *  - typed by hand (MANUAL): everything - you wrote it, you can change it
 *  - imported (CSV/PSD2): only the category. Amount and date are the bank's
 *    record; editing them would make the row disagree with the bank's own
 *    running balance. Imported rows are FILED and RENAMED, never rewritten -
 *    renaming goes through taught rules.
 *
 * Every save sends ONE field. That is only safe because PATCH is a true
 * partial update - before that fix, saving one field wiped the others.
 */
type Field = 'name' | 'amount' | 'date' | 'note'

const props = defineProps<{
  transaction: Transaction | null
  category: Category | undefined
}>()

const emit = defineEmits<{
  close: []
  remove: [t: Transaction]
  teach: [t: Transaction]
  updated: [t: Transaction]
}>()

const rules = useRulesStore()
const categories = useCategoriesStore()
const txStore = useTransactionsStore()

const menuOpen = ref(false)
const field = ref<Field | null>(null)
const draft = ref('')
const saving = ref(false)
const fieldError = ref<string | null>(null)

const t = computed(() => props.transaction)
const editable = computed(() => t.value?.source === 'MANUAL')
const isIncome = computed(() => (t.value?.amountCents ?? 0) > 0)
const isTransfer = computed(() => props.category?.kind === 'TRANSFER')

watch(() => props.transaction?.id, () => {
  menuOpen.value = false
  cancel()
})

// Escape unwinds one level at a time: the field being edited, then the menu,
// then the drawer. One key, in the order you'd expect.
function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (field.value) cancel()
  else if (menuOpen.value) menuOpen.value = false
  else if (props.transaction) emit('close')
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

function start(f: Field) {
  if (!t.value || !editable.value) return
  fieldError.value = null
  field.value = f
  draft.value = {
    name: t.value.counterparty ?? '',
    amount: centsToInput(t.value.amountCents),
    date: t.value.bookedAt.slice(0, 10),
    note: t.value.description ?? '',
  }[f]
  // Focus the input once Vue has rendered it.
  nextTick(() => document.querySelector<HTMLInputElement>('.inline-input')?.focus())
}

function cancel() {
  field.value = null
  draft.value = ''
  fieldError.value = null
}

async function save() {
  if (!t.value || !field.value) return
  const f = field.value
  let body: Record<string, unknown>

  if (f === 'amount') {
    const value = draft.value.trim().replace(/^[-+]/, '')
    if (!value) { fieldError.value = 'Enter an amount'; return }
    // Keep the row's direction: editing the number never flips an expense
    // into income. The sign is applied here, in one place.
    body = { amount: t.value.amountCents < 0 ? `-${value}` : value }
  } else if (f === 'date') {
    if (!draft.value) { fieldError.value = 'Pick a date'; return }
    body = { bookedAt: draft.value }
  } else if (f === 'name') {
    body = { counterparty: draft.value }
  } else {
    body = { description: draft.value }
  }

  await commit(body)
}

async function setCategory(e: Event) {
  const id = (e.target as HTMLSelectElement).value
  await commit({ categoryId: id || null })
}

async function commit(body: Record<string, unknown>) {
  if (!t.value) return
  saving.value = true
  fieldError.value = null
  const updated = await txStore.patch(t.value.id, body)
  saving.value = false
  if (!updated) {
    fieldError.value = txStore.error ?? 'Could not save'
    return
  }
  field.value = null
  emit('updated', updated)
}

function onInputKey(e: KeyboardEvent) {
  if (e.key === 'Enter') { e.preventDefault(); save() }
}

const fullDate = computed(() =>
  t.value
    ? new Date(t.value.bookedAt).toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    : '',
)

const sourceLabel = computed(() => ({
  MANUAL: 'Added by hand',
  CSV: 'Imported from a bank CSV',
  PSD2: 'Synced from the bank',
}[t.value?.source ?? 'MANUAL']))

// Categories that make sense for this row's direction, plus transfers,
// which can go either way.
const categoryOptions = computed(() => [
  ...(isIncome.value ? categories.income : categories.expense),
  ...categories.transfer,
])
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="t" class="scrim" @click.self="emit('close')">
        <div
          class="neu-4 sheet"
          role="dialog"
          aria-modal="true"
          :aria-label="transactionLabel(t.counterparty, t.description, rules.items)"
        >
          <div class="grab" aria-hidden="true" />

          <header class="top">
            <span
              class="icon neu"
              :style="category ? { background: `var(--vv-${category.color})`, color: `var(--vv-${category.color}-fg)` } : {}"
              aria-hidden="true"
            >{{ category?.icon ?? '·' }}</span>

            <div class="menu-wrap">
              <button
                class="menu-btn"
                type="button"
                aria-label="Actions"
                :aria-expanded="menuOpen"
                aria-haspopup="menu"
                @click="menuOpen = !menuOpen"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <circle cx="9" cy="3.5" r="1.6" fill="currentColor" />
                  <circle cx="9" cy="9" r="1.6" fill="currentColor" />
                  <circle cx="9" cy="14.5" r="1.6" fill="currentColor" />
                </svg>
              </button>

              <div v-if="menuOpen" class="neu-2 menu" role="menu">
                <button class="menu-item" type="button" role="menuitem" @click="emit('teach', t!)">
                  <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M2.5 4.5h7M2.5 8h11M2.5 11.5h7M12 2.5l1.5 2 -1.5 2"
                          fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  Rename &amp; categorise all like this
                </button>
                <button class="menu-item danger" type="button" role="menuitem" @click="emit('remove', t!)">
                  <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.2a1 1 0 0 0 1 .8h3.8a1 1 0 0 0 1-.8l.6-8.2"
                          fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
                  </svg>
                  Delete
                </button>
              </div>
            </div>
          </header>

          <!-- AMOUNT -->
          <div v-if="field === 'amount'" class="inline amount-edit">
            <span class="sign">{{ t.amountCents < 0 ? '−' : '+' }} €</span>
            <input v-model="draft" class="vv-field inline-input big" inputmode="decimal" @keydown="onInputKey" />
            <button class="ok" type="button" :disabled="saving" aria-label="Save" @click="save">✓</button>
            <button class="no" type="button" aria-label="Cancel" @click="cancel">✕</button>
          </div>
          <button
            v-else
            class="amount value"
            :class="[isTransfer ? 'moved' : isIncome ? 'in' : 'out', { editable }]"
            type="button"
            :disabled="!editable"
            @click="start('amount')"
          >
            {{ formatCents(t.amountCents, { signed: isIncome }) }}
          </button>
          <p v-if="isTransfer" class="transfer-note">Between your own accounts — not income or spending</p>

          <!-- NAME -->
          <div v-if="field === 'name'" class="inline">
            <input v-model="draft" class="vv-field inline-input" maxlength="120" placeholder="Who was it?" @keydown="onInputKey" />
            <button class="ok" type="button" :disabled="saving" aria-label="Save" @click="save">✓</button>
            <button class="no" type="button" aria-label="Cancel" @click="cancel">✕</button>
          </div>
          <button
            v-else
            class="title value"
            :class="{ editable }"
            type="button"
            :disabled="!editable"
            @click="start('name')"
          >{{ transactionLabel(t.counterparty, t.description, rules.items) }}</button>

          <p v-if="fieldError" class="vv-error field-error">{{ fieldError }}</p>

          <dl class="details">
            <!-- DATE -->
            <div class="detail neu-divider">
              <dt>Date</dt>
              <dd v-if="field === 'date'" class="inline">
                <input v-model="draft" class="vv-field inline-input small" type="date" @keydown="onInputKey" />
                <button class="ok" type="button" :disabled="saving" aria-label="Save" @click="save">✓</button>
                <button class="no" type="button" aria-label="Cancel" @click="cancel">✕</button>
              </dd>
              <dd v-else>
                <button class="value" :class="{ editable }" type="button" :disabled="!editable" @click="start('date')">
                  {{ fullDate }}
                </button>
              </dd>
            </div>

            <!-- CATEGORY: editable for every row, saves the moment you pick -->
            <div class="detail neu-divider">
              <dt><label for="drawer-cat">Category</label></dt>
              <dd>
                <select
                  id="drawer-cat"
                  class="cat-select"
                  :value="t.categoryId ?? ''"
                  :disabled="saving"
                  @change="setCategory"
                >
                  <option value="">Uncategorised</option>
                  <option v-for="c in categoryOptions" :key="c.id" :value="c.id">{{ c.icon }} {{ c.name }}</option>
                </select>
              </dd>
            </div>

            <!-- NOTE: only for rows you typed; imported text is the bank's -->
            <div v-if="editable" class="detail neu-divider">
              <dt>Note</dt>
              <dd v-if="field === 'note'" class="inline">
                <input v-model="draft" class="vv-field inline-input small" maxlength="500" placeholder="Optional" @keydown="onInputKey" />
                <button class="ok" type="button" :disabled="saving" aria-label="Save" @click="save">✓</button>
                <button class="no" type="button" aria-label="Cancel" @click="cancel">✕</button>
              </dd>
              <dd v-else>
                <button class="value editable" type="button" @click="start('note')">
                  {{ t.description || 'Add a note' }}
                </button>
              </dd>
            </div>

            <div v-if="t.counterpartyIban" class="detail neu-divider">
              <dt>Account</dt><dd class="mono">{{ t.counterpartyIban }}</dd>
            </div>
            <div v-if="t.balanceAfterCents != null" class="detail neu-divider">
              <dt>Balance after</dt><dd class="mono">{{ formatCents(t.balanceAfterCents) }}</dd>
            </div>
            <div class="detail">
              <dt>Source</dt><dd>{{ sourceLabel }}</dd>
            </div>
          </dl>

          <p v-if="!editable" class="locked">
            Amount and date come from your bank and stay as the bank recorded them.
            To rename it, use <strong>⋯ → Rename &amp; categorise all like this</strong>.
          </p>

          <details v-if="t.description && !editable" class="raw">
            <summary>Original bank description</summary>
            <p>{{ t.description }}</p>
          </details>

          <button class="vv-btn vv-btn--ghost close" type="button" @click="emit('close')">Close</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.scrim {
  position: fixed; inset: 0; z-index: 50;
  display: flex; align-items: flex-end; justify-content: center;
  background: rgba(0, 0, 0, .38); backdrop-filter: blur(2px);
}
.sheet {
  position: relative; width: 100%; max-width: 460px;
  max-height: 88vh; overflow-y: auto;
  padding: 14px 24px calc(24px + env(safe-area-inset-bottom));
  border-radius: var(--vv-r-lg) var(--vv-r-lg) 0 0;
}
@media (min-width: 600px) {
  .scrim { align-items: center; padding: 24px; }
  .sheet { border-radius: var(--vv-r-lg); padding-top: 20px; }
  .grab { display: none; }
}
.grab { width: 38px; height: 4px; margin: 0 auto 14px; border-radius: 999px; background: var(--vv-shadow-dark); }

.top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.icon {
  display: grid; place-items: center; width: 46px; height: 46px; flex: none;
  border-radius: var(--vv-r-sm); font-size: 20px; color: var(--vv-muted-2);
}

.menu-wrap { position: relative; }
.menu-btn {
  width: 38px; height: 38px; display: grid; place-items: center;
  color: var(--vv-muted); background: var(--vv-surface);
  border: none; border-radius: var(--vv-r-badge); box-shadow: var(--vv-e1); cursor: pointer;
  transition: box-shadow .12s ease, color .12s ease;
}
.menu-btn:hover { color: var(--vv-text); }
.menu-btn[aria-expanded='true'] { box-shadow: var(--vv-p1); color: var(--vv-accent); }
.menu {
  position: absolute; top: 46px; right: 0; z-index: 2;
  min-width: 250px; padding: 6px; display: flex; flex-direction: column; gap: 2px;
}
.menu-item {
  display: flex; align-items: center; gap: 10px; padding: 10px 12px; width: 100%;
  font: inherit; font-size: 14px; font-weight: 600; text-align: left;
  color: var(--vv-text); background: none; border: none; border-radius: var(--vv-r-badge); cursor: pointer;
}
.menu-item:hover { box-shadow: var(--vv-p1); }
.menu-item.danger { color: var(--vv-negative); }

/* ---- values that become inputs ------------------------------------------
   Read-only values look like plain text. Editable ones gain a quiet pencil on
   hover/focus - a hint, not a shout, so the sheet still reads as a summary. */
.value {
  padding: 0; font: inherit; color: inherit; text-align: inherit;
  background: none; border: none; border-radius: 6px;
}
.value:disabled { cursor: default; }
.value.editable { cursor: pointer; }
.value.editable:hover::after, .value.editable:focus-visible::after {
  content: ' ✎'; font-size: .8em; color: var(--vv-muted-2);
}
.value:focus-visible { outline: 2px solid var(--vv-accent-ring); outline-offset: 3px; }

.amount {
  display: block; margin: 18px 0 2px;
  font-size: 34px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -.01em;
}
.amount.in { color: var(--vv-accent); }
.amount.out { color: var(--vv-text); }
.amount.moved { color: var(--vv-muted); }
.transfer-note { margin: -2px 0 8px; font-size: 12px; font-weight: 600; color: var(--vv-muted-2); }
.title { display: block; margin: 0 0 20px; font-size: 15px; font-weight: 600; color: var(--vv-muted); }

.inline { display: flex; align-items: center; gap: 8px; }
.amount-edit { margin: 16px 0 8px; }
.sign { font-size: 22px; font-weight: 700; color: var(--vv-muted); flex: none; }
.inline-input { flex: 1; min-width: 0; }
.inline-input.big { font-size: 22px; font-weight: 700; padding: 10px 14px; }
.inline-input.small { padding: 8px 10px; font-size: 13px; }
.ok, .no {
  width: 34px; height: 34px; flex: none; display: grid; place-items: center;
  font: inherit; font-size: 15px; font-weight: 700; line-height: 1;
  background: var(--vv-surface); border: none; border-radius: var(--vv-r-badge);
  box-shadow: var(--vv-e1); cursor: pointer;
}
.ok { color: var(--vv-accent); }
.no { color: var(--vv-muted); }
.ok:active, .no:active { box-shadow: var(--vv-p1); }
.field-error { margin: 0 0 12px; }

.details { margin: 0; }
.detail { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 12px 0; }
dt { font-size: 13px; color: var(--vv-muted); flex: none; }
dd { margin: 0; font-size: 13px; font-weight: 600; text-align: right; min-width: 0; }
dd.inline { flex: 1; justify-content: flex-end; }
dd.mono { font-family: ui-monospace, monospace; font-size: 12px; }

.cat-select {
  max-width: 220px; padding: 7px 10px;
  font: inherit; font-size: 13px; font-weight: 600; color: var(--vv-text);
  background: var(--vv-surface); border: none; border-radius: var(--vv-r-badge);
  box-shadow: var(--vv-e1); cursor: pointer;
}
.cat-select:focus-visible { outline: none; box-shadow: var(--vv-p1), 0 0 0 2px var(--vv-accent-ring); }

.locked { margin: 14px 0 0; font-size: 12px; line-height: 1.5; color: var(--vv-muted-2); }

.raw { margin-top: 14px; font-size: 13px; }
.raw summary { cursor: pointer; color: var(--vv-muted); font-weight: 600; }
.raw p {
  margin: 10px 0 0; padding: 12px; font-size: 12px; line-height: 1.5;
  color: var(--vv-muted); word-break: break-word;
  border-radius: var(--vv-r-sm); box-shadow: var(--vv-p1);
}

.close { margin-top: 22px; }

.drawer-enter-active, .drawer-leave-active { transition: opacity .2s ease; }
.drawer-enter-active .sheet, .drawer-leave-active .sheet { transition: transform .24s cubic-bezier(.22, 1, .36, 1); }
.drawer-enter-from, .drawer-leave-to { opacity: 0; }
.drawer-enter-from .sheet, .drawer-leave-to .sheet { transform: translateY(14%); }
@media (prefers-reduced-motion: reduce) {
  .drawer-enter-active, .drawer-leave-active,
  .drawer-enter-active .sheet, .drawer-leave-active .sheet { transition: none; }
  .drawer-enter-from .sheet, .drawer-leave-to .sheet { transform: none; }
}
</style>
