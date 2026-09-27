<script setup lang="ts">
import { EllipsisVertical, Sparkles, Trash2, Check, X, ChevronRight, ChevronLeft, CircleDashed } from 'lucide-vue-next'
import { centsToInput } from '~~/shared/utils/money'
import { transactionLabel } from '~~/shared/utils/merchant'
import { useTransactionsStore, type Transaction } from '~/stores/transactions'
import type { Category } from '~/stores/categories'
import { useRulesStore } from '~/stores/rules'

/**
 * Read-first detail view with INLINE editing, in a UiBottomSheet - so it
 * drags down to close exactly like the Add sheet.
 *
 * Still read-first: every value looks like text until you tap it, so opening
 * a row can't change anything by accident. Tapping a value turns just that
 * value into an input.
 *
 * What is editable depends on WHERE the row came from:
 *  - typed by hand (MANUAL): everything - you wrote it, you can change it
 *  - imported (CSV/PSD2): only the category. Amount and date are the bank's
 *    record; editing them would make the row disagree with the bank's own
 *    running balance. Imported rows are FILED and RENAMED, never rewritten -
 *    renaming goes through taught rules.
 *
 * Category is picked from TILES (CategoryPicker) in a second view of the same
 * sheet, not a dropdown: bigger targets, the category's own colour, saves on tap.
 *
 * Every save sends ONE field. That is only safe because PATCH is a true
 * partial update.
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

const { t: tr } = useI18n()
const { money, date } = useFormat()
const rules = useRulesStore()
const txStore = useTransactionsStore()

// The sheet animates OUT after `transaction` becomes null. Keep showing the
// last row during that animation instead of rendering an empty sheet.
const shown = ref<Transaction | null>(props.transaction)
watch(() => props.transaction, (tx) => { if (tx) shown.value = tx })
const t = computed(() => shown.value)
const open = computed(() => !!props.transaction)

const menuOpen = ref(false)
const picking = ref(false)
const field = ref<Field | null>(null)
const draft = ref('')
const saving = ref(false)
const fieldError = ref<string | null>(null)

const editable = computed(() => t.value?.source === 'MANUAL')
const isIncome = computed(() => (t.value?.amountCents ?? 0) > 0)
const isTransfer = computed(() => props.category?.kind === 'TRANSFER')
const label = computed(() => (t.value ? transactionLabel(t.value.counterparty, t.value.description, rules.items) : ''))

watch(() => props.transaction?.id, () => {
  menuOpen.value = false
  picking.value = false
  cancel()
})

// Escape unwinds one level at a time: the field being edited, then the menu
// or category picker, then the sheet. One key, in the order you'd expect.
function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !open.value) return
  if (field.value) cancel()
  else if (menuOpen.value) menuOpen.value = false
  else if (picking.value) picking.value = false
  else emit('close')
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

function onSheet(isOpen: boolean) {
  if (!isOpen) emit('close')
}

// ---- Inline editing ------------------------------------------------------
const input = ref<HTMLInputElement | null>(null)

function start(f: Field) {
  if (!t.value || !editable.value) return
  menuOpen.value = false
  fieldError.value = null
  field.value = f
  draft.value = {
    name: t.value.counterparty ?? '',
    amount: centsToInput(t.value.amountCents),
    date: t.value.bookedAt.slice(0, 10),
    note: t.value.description ?? '',
  }[f]
  nextTick(() => input.value?.focus())
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
    const value = draft.value.trim().replace(/^[-+−]/, '')
    if (!value) { fieldError.value = tr('drawer.enterAmount'); return }
    // Keep the row's direction: editing the number never flips an expense
    // into income. The sign is applied here, in one place.
    body = { amount: t.value.amountCents < 0 ? `-${value}` : value }
  } else if (f === 'date') {
    if (!draft.value) { fieldError.value = tr('drawer.pickDate'); return }
    body = { bookedAt: draft.value }
  } else if (f === 'name') {
    body = { counterparty: draft.value }
  } else {
    body = { description: draft.value }
  }

  await commit(body)
}

async function commit(body: Record<string, unknown>) {
  if (!t.value) return false
  saving.value = true
  fieldError.value = null
  const updated = await txStore.patch(t.value.id, body)
  saving.value = false
  if (!updated) {
    fieldError.value = tr('drawer.couldNotSave')
    return false
  }
  field.value = null
  shown.value = updated
  emit('updated', updated)
  return true
}

function onInputKey(e: KeyboardEvent) {
  if (e.key === 'Enter') { e.preventDefault(); save() }
}

// ---- Category picker -----------------------------------------------------
// The tapped tile lights up IMMEDIATELY; the save (a round trip to the
// database) confirms it a moment later. Without this, a tap looks ignored.
const pendingId = ref<string | null | undefined>(undefined)
const chosenId = computed(() => (pendingId.value !== undefined ? pendingId.value : (t.value?.categoryId ?? null)))

async function pick(id: string | null) {
  if (saving.value) return
  if (id === (t.value?.categoryId ?? null)) { picking.value = false; return }
  pendingId.value = id
  const ok = await commit({ categoryId: id })
  pendingId.value = undefined // on failure the old choice lights up again
  if (ok) picking.value = false
}

function tint(c: { color: string } | undefined) {
  return c ? { background: `var(--vv-${c.color})`, color: `var(--vv-${c.color}-fg)` } : {}
}

// ---- Display -------------------------------------------------------------
const fullDate = computed(() =>
  t.value ? date(t.value.bookedAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '',
)

const sourceLabel = computed(() => ({
  MANUAL: tr('drawer.sourceManual'),
  CSV: tr('drawer.sourceCsv'),
  PSD2: tr('drawer.sourcePsd2'),
}[t.value?.source ?? 'MANUAL']))
</script>

<template>
  <UiBottomSheet :model-value="open" :label="label" :close-on-escape="false" @update:model-value="onSheet">
    <template v-if="t">
      <!-- ============ CATEGORY PICKER ============ -->
      <div v-if="picking" class="picker">
        <header class="p-head">
          <UiIconButton :icon="ChevronLeft" :label="tr('common.back')" size="sm" @click="picking = false" />
          <h2>{{ tr('drawer.pickCategory') }}</h2>
        </header>

        <CategoryPicker
          :model-value="chosenId"
          :direction="isIncome ? 'in' : 'out'"
          :disabled="saving"
          @update:model-value="pick"
        />

        <p v-if="fieldError" class="vv-error">{{ fieldError }}</p>
      </div>

      <!-- ============ DETAILS ============ -->
      <div v-else>
        <header class="top">
          <span class="icon neu" :style="tint(category)" aria-hidden="true">
            <template v-if="category">{{ category.icon }}</template>
            <CircleDashed v-else :size="20" />
          </span>

          <div class="menu-wrap">
            <UiIconButton :icon="X" :label="tr('common.close')" @click="emit('close')" />
            <UiIconButton
              :icon="EllipsisVertical"
              :label="tr('drawer.actions')"
              :active="menuOpen"
              aria-haspopup="menu"
              :aria-expanded="menuOpen"
              @click="menuOpen = !menuOpen"
            />
            <div v-if="menuOpen" class="neu-2 menu" role="menu">
              <button class="menu-item" type="button" role="menuitem" @click="emit('teach', t)">
                <Sparkles :size="16" aria-hidden="true" /> {{ tr('drawer.teach') }}
              </button>
              <button class="menu-item danger" type="button" role="menuitem" @click="emit('remove', t)">
                <Trash2 :size="16" aria-hidden="true" /> {{ tr('drawer.delete') }}
              </button>
            </div>
          </div>
        </header>

        <!-- AMOUNT -->
        <div v-if="field === 'amount'" class="inline amount-edit">
          <span class="sign">{{ t.amountCents < 0 ? '−' : '+' }} €</span>
          <input ref="input" v-model="draft" class="vv-field inline-input big" inputmode="decimal" @keydown="onInputKey" />
          <UiIconButton :icon="Check" :label="tr('common.save')" @click="save" />
          <UiIconButton :icon="X" :label="tr('common.cancel')" @click="cancel" />
        </div>
        <button
          v-else
          class="amount value"
          :class="[isTransfer ? 'moved' : isIncome ? 'in' : 'out', { editable }]"
          type="button"
          :disabled="!editable"
          :aria-label="editable ? tr('drawer.change', { field: money(t.amountCents) }) : undefined"
          @click="start('amount')"
        >{{ money(t.amountCents, { signed: isIncome }) }}</button>
        <p v-if="isTransfer" class="transfer-note">{{ tr('drawer.transferNote') }}</p>

        <!-- NAME -->
        <div v-if="field === 'name'" class="inline">
          <input ref="input" v-model="draft" class="vv-field inline-input" maxlength="120" :placeholder="tr('drawer.whoPh')" @keydown="onInputKey" />
          <UiIconButton :icon="Check" :label="tr('common.save')" @click="save" />
          <UiIconButton :icon="X" :label="tr('common.cancel')" @click="cancel" />
        </div>
        <button
          v-else
          class="title value"
          :class="{ editable }"
          type="button"
          :disabled="!editable"
          @click="start('name')"
        >{{ label }}</button>

        <p v-if="fieldError" class="vv-error field-error">{{ fieldError }}</p>

        <dl class="details">
          <!-- DATE -->
          <div class="detail">
            <dt>{{ tr('drawer.date') }}</dt>
            <dd v-if="field === 'date'" class="inline">
              <input ref="input" v-model="draft" class="vv-field inline-input" type="date" @keydown="onInputKey" />
              <UiIconButton :icon="Check" :label="tr('common.save')" size="sm" @click="save" />
              <UiIconButton :icon="X" :label="tr('common.cancel')" size="sm" @click="cancel" />
            </dd>
            <dd v-else>
              <button class="value" :class="{ editable }" type="button" :disabled="!editable" @click="start('date')">
                {{ fullDate }}
              </button>
            </dd>
          </div>

          <!-- CATEGORY: a row that opens the tile picker - for every row -->
          <div class="detail">
            <dt>{{ tr('drawer.category') }}</dt>
            <dd>
              <button class="cat-row" type="button" @click="menuOpen = false; picking = true">
                <span class="cr-icon" :style="tint(category)" aria-hidden="true">
                  <template v-if="category">{{ category.icon }}</template>
                  <CircleDashed v-else :size="14" />
                </span>
                <span>{{ category?.name ?? tr('home.unsorted') }}</span>
                <ChevronRight :size="16" class="chev" aria-hidden="true" />
              </button>
            </dd>
          </div>

          <!-- NOTE: only for rows you typed; imported text is the bank's -->
          <div v-if="editable" class="detail">
            <dt>{{ tr('drawer.note') }}</dt>
            <dd v-if="field === 'note'" class="inline">
              <input ref="input" v-model="draft" class="vv-field inline-input" maxlength="500" :placeholder="tr('common.optional')" @keydown="onInputKey" />
              <UiIconButton :icon="Check" :label="tr('common.save')" size="sm" @click="save" />
              <UiIconButton :icon="X" :label="tr('common.cancel')" size="sm" @click="cancel" />
            </dd>
            <dd v-else>
              <button class="value editable" type="button" @click="start('note')">
                {{ t.description || tr('drawer.addNote') }}
              </button>
            </dd>
          </div>

          <div v-if="t.counterpartyIban" class="detail">
            <dt>{{ tr('drawer.account') }}</dt><dd class="mono">{{ t.counterpartyIban }}</dd>
          </div>
          <div v-if="t.balanceAfterCents != null" class="detail">
            <dt>{{ tr('drawer.balanceAfter') }}</dt><dd>{{ money(t.balanceAfterCents) }}</dd>
          </div>
          <div class="detail">
            <dt>{{ tr('drawer.source') }}</dt><dd>{{ sourceLabel }}</dd>
          </div>
        </dl>

        <p v-if="!editable" class="locked">{{ tr('drawer.locked') }}</p>

        <details v-if="t.description && !editable" class="raw">
          <summary>{{ tr('drawer.original') }}</summary>
          <p>{{ t.description }}</p>
        </details>
      </div>
    </template>
  </UiBottomSheet>
</template>

<style scoped>
.top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.icon {
  display: grid; place-items: center; width: 48px; height: 48px; flex: none;
  border-radius: var(--vv-r-sm); font-size: 21px; color: var(--vv-muted);
}

.menu-wrap { position: relative; display: flex; gap: 10px; }
.menu {
  position: absolute; top: calc(var(--vv-control) + 8px); right: 0; z-index: 2;
  min-width: 260px; padding: 6px; display: flex; flex-direction: column; gap: 2px;
}
.menu-item {
  display: flex; align-items: center; gap: 10px; padding: 12px; width: 100%;
  font: inherit; font-size: 14px; font-weight: 600; text-align: left;
  color: var(--vv-text); background: none; border: none; border-radius: var(--vv-r-badge); cursor: pointer;
}
.menu-item:hover, .menu-item:focus-visible { box-shadow: var(--vv-p1); outline: none; }
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
  font-size: 36px; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: -.02em;
}
.amount.in { color: var(--vv-accent); }
.amount.out { color: var(--vv-text); }
.amount.moved { color: var(--vv-muted); }
.transfer-note { margin: 0 0 8px; font-size: 13px; font-weight: 600; color: var(--vv-muted); }
.title { display: block; margin: 0 0 18px; font-size: 16px; font-weight: 600; color: var(--vv-muted); }

.inline { display: flex; align-items: center; gap: 8px; }
.amount-edit { margin: 16px 0 10px; }
.sign { font-size: 22px; font-weight: 700; color: var(--vv-muted); flex: none; }
.inline-input { flex: 1; min-width: 0; }
.inline-input.big { font-size: 22px; font-weight: 700; }
.field-error { margin: 0 0 12px; }

.details { margin: 0; }
.detail { display: flex; align-items: center; justify-content: space-between; gap: 18px; min-height: 52px; padding: 8px 0; }
.detail + .detail { border-top: 1px solid var(--vv-shadow-dark); }
dt { font-size: 14px; color: var(--vv-muted); flex: none; }
dd { margin: 0; font-size: 14px; font-weight: 600; text-align: right; min-width: 0; overflow-wrap: anywhere; }
dd.inline { flex: 1; justify-content: flex-end; }
dd.mono { font-family: ui-monospace, monospace; font-size: 12px; }

/* Category row: reads like the other values, with a tile + chevron that
   says "tap to change" - no dropdown chrome. */
.cat-row {
  display: inline-flex; align-items: center; gap: 8px; padding: 6px 4px 6px 6px;
  font: inherit; font-size: 14px; font-weight: 600; color: var(--vv-text);
  background: none; border: none; border-radius: var(--vv-r-badge); cursor: pointer;
}
.cat-row:active { box-shadow: var(--vv-p1); }
.cat-row:focus-visible { outline: 2px solid var(--vv-accent-ring); outline-offset: 2px; }
.cr-icon {
  display: grid; place-items: center; width: 28px; height: 28px; flex: none;
  font-size: 14px; color: var(--vv-muted); border-radius: 8px; box-shadow: var(--vv-e1);
}
.chev { color: var(--vv-muted-2); }

.locked { margin: 14px 0 0; font-size: 13px; line-height: 1.5; color: var(--vv-muted); }

.raw { margin-top: 14px; font-size: 13px; }
.raw summary { cursor: pointer; color: var(--vv-muted); font-weight: 600; }
.raw p {
  margin: 10px 0 0; padding: 12px; font-size: 12px; line-height: 1.5;
  color: var(--vv-muted); word-break: break-word;
  border-radius: var(--vv-r-sm); box-shadow: var(--vv-p1);
}

/* ---- Category picker ---------------------------------------------------- */
.p-head { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.p-head h2 { margin: 0; font-size: 19px; font-weight: 800; }

</style>
