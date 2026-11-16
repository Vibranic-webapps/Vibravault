<script setup lang="ts">
import { Check, SkipForward, Undo2, Pencil, Pause, Play, Trash2, Link2 } from 'lucide-vue-next'
import { useRecurringStore, type Occ, type RecurringItem } from '~/stores/recurring'
import { STATE_ICON, isOpen, isSettled, useRecurringText, type RowState } from './recurringText'

/**
 * One recurring bill / income in a sheet: what it is, when it is due, what state
 * that is in, and every action (mark paid / received, skip, undo, edit, pause, delete).
 *
 * Mount it ONCE per page (not behind a v-if): it also hosts the edit form and the
 * delete confirmation, which open after this sheet closes (one sheet at a time).
 * `occ` is the occurrence the user tapped (Home passes the dashboard's); after an
 * action we re-read it from the item the server sends back.
 */
const props = defineProps<{
  modelValue: boolean
  itemId: string | null
  occ: Occ | null
}>()
const emit = defineEmits<{ 'update:modelValue': [open: boolean] }>()

const { t } = useI18n()
const { toast } = useToast()
const store = useRecurringStore()
const { longDate, shortDate, stateText, cadenceName, kindWord, money } = useRecurringText()

const item = computed<RecurringItem | null>(() => (props.itemId ? store.byId.get(props.itemId) ?? null : null))

/** The occurrence on screen: the tapped one, refreshed from the item when it still exists there. */
const shown = computed<Occ | null>(() => {
  const it = item.value
  if (!it) return props.occ
  const want = props.occ?.dueOn
  if (want) {
    if (it.next?.dueOn === want) return it.next
    if (it.last?.dueOn === want) return it.last
    return props.occ
  }
  return it.next
})

const state = computed<RowState>(() => (item.value && !item.value.active ? 'paused' : shown.value?.state ?? 'upcoming'))
const StateIcon = computed(() => STATE_ICON[state.value])
const settled = computed(() => isSettled(state.value))
const open = computed(() => isOpen(state.value))
const isIncome = computed(() => item.value?.direction === 'IN')

/** Undo only exists for what was done by hand; an automatic bank match can't be undone here. */
const canUndo = computed(() => state.value === 'markedPaid' || state.value === 'skipped')

const amountLine = computed(() => {
  const it = item.value
  if (!it) return ''
  const sign = (c: number) => (it.direction === 'IN' ? money(c, { signed: true }) : money(-c))
  return it.amountMinCents === it.amountMaxCents
    ? sign(it.amountMinCents)
    : `${sign(it.amountMinCents)} – ${sign(it.amountMaxCents)}`
})

const statusLine = computed(() =>
  item.value ? stateText(state.value, item.value.direction, shown.value) : '',
)

// ---- Actions ------------------------------------------------------------------
const busy = ref(false)
const actionError = ref('')

async function run(job: () => Promise<RecurringItem | null>, done: string) {
  if (busy.value) return
  busy.value = true
  actionError.value = ''
  const res = await job()
  busy.value = false
  if (!res) {
    actionError.value = t('recurring.error.generic')
    return
  }
  toast(done)
}

const markPaid = () => run(
  () => store.settle(item.value!.id, shown.value!.dueOn, 'MARKED_PAID'),
  isIncome.value ? t('recurring.toast.received') : t('recurring.toast.paid'),
)
const skip = () => run(() => store.settle(item.value!.id, shown.value!.dueOn, 'SKIPPED'), t('recurring.toast.skipped'))
const undo = () => run(() => store.unsettle(item.value!.id, shown.value!.dueOn), t('recurring.toast.undone'))
const togglePause = () =>
  run(() => store.update(item.value!.id, { active: !item.value!.active }), item.value!.active ? t('recurring.toast.paused') : t('recurring.toast.resumed'))

// ---- Edit + delete live in their own sheet/dialog, opened after this one closes ----
const formOpen = ref(false)
const editTarget = ref<RecurringItem | null>(null)
const confirmOpen = ref(false)
const deleting = ref(false)

function close() { emit('update:modelValue', false) }

async function edit() {
  editTarget.value = item.value
  close()
  await nextTick()
  formOpen.value = true
}
async function askDelete() {
  close()
  await nextTick()
  confirmOpen.value = true
}
async function confirmDelete() {
  const id = editTarget.value?.id ?? item.value?.id
  if (!id || deleting.value) return
  deleting.value = true
  const ok = await store.remove(id)
  deleting.value = false
  confirmOpen.value = false
  toast(ok ? t('recurring.toast.deleted') : t('recurring.error.generic'))
}
// Remember what we are deleting once the sheet has closed (itemId may be cleared by the page).
watch(confirmOpen, (o) => { if (o) editTarget.value = item.value ?? editTarget.value })
</script>

<template>
  <UiBottomSheet :model-value="modelValue && !!item" :title="item?.name ?? ''" @update:model-value="(v: boolean) => emit('update:modelValue', v)">
    <div v-if="item" class="detail">
      <p class="state" :class="state">
        <component :is="StateIcon" :size="16" :stroke-width="2.6" aria-hidden="true" />
        {{ statusLine }}
      </p>

      <dl class="facts neu-pressed">
        <div>
          <dt>{{ isIncome ? t('recurring.detail.expectedIncome') : t('recurring.detail.amount') }}</dt>
          <dd class="big">{{ amountLine }}</dd>
        </div>
        <div>
          <dt>{{ t('recurring.detail.repeats') }}</dt>
          <dd>{{ kindWord(item.direction) }}, {{ cadenceName(item.cadence) }}</dd>
        </div>
        <div v-if="shown">
          <dt>{{ t('recurring.detail.due') }}</dt>
          <dd>{{ longDate(shown.dueOn) }}</dd>
        </div>
        <div v-if="shown?.paidOn && settled && state !== 'skipped'">
          <dt>{{ isIncome ? t('recurring.detail.receivedOn') : t('recurring.detail.paidOn') }}</dt>
          <dd>{{ shortDate(shown.paidOn) }}</dd>
        </div>
        <div v-if="item.category">
          <dt>{{ t('recurring.detail.category') }}</dt>
          <dd>{{ item.category.name }}</dd>
        </div>
        <div>
          <dt>{{ t('recurring.detail.match') }}</dt>
          <dd class="mono">{{ item.match }}</dd>
        </div>
      </dl>

      <p v-if="shown?.transactionId" class="link-hint">
        <Link2 :size="15" :stroke-width="2.4" aria-hidden="true" />
        {{ t('recurring.detail.matched') }}
      </p>
      <p v-else-if="state === 'markedPaid'" class="link-hint">{{ t('recurring.detail.byHand') }}</p>

      <p v-if="actionError" class="vv-error" role="alert">{{ actionError }}</p>

      <div class="actions">
        <template v-if="open && item.active">
          <UiButton :icon="Check" :loading="busy" @click="markPaid">
            {{ isIncome ? t('recurring.action.received') : t('recurring.action.markPaid') }}
          </UiButton>
          <UiButton variant="ghost" :icon="SkipForward" :disabled="busy" @click="skip">{{ t('recurring.action.skip') }}</UiButton>
        </template>
        <UiButton v-if="canUndo" variant="ghost" :icon="Undo2" :loading="busy" @click="undo">{{ t('recurring.action.undo') }}</UiButton>

        <div class="row2">
          <UiButton variant="ghost" :icon="Pencil" :disabled="busy" @click="edit">{{ t('common.edit') }}</UiButton>
          <UiButton variant="ghost" :icon="item.active ? Pause : Play" :disabled="busy" @click="togglePause">
            {{ item.active ? t('recurring.action.pause') : t('recurring.action.resume') }}
          </UiButton>
        </div>
        <UiButton variant="danger" :icon="Trash2" :disabled="busy" @click="askDelete">{{ t('common.delete') }}</UiButton>
      </div>
    </div>
  </UiBottomSheet>

  <RecurringFormSheet v-model="formOpen" :item="editTarget" />

  <UiConfirmDialog
    :open="confirmOpen"
    :title="t('recurring.confirm.title', { name: editTarget?.name ?? '' })"
    :body="t('recurring.confirm.body')"
    :confirm-label="t('common.delete')"
    :cancel-label="t('common.cancel')"
    destructive
    :loading="deleting"
    @confirm="confirmDelete"
    @cancel="confirmOpen = false"
  />
</template>

<style scoped>
.detail { display: grid; gap: 16px; }

.state { display: inline-flex; align-items: center; gap: 6px; margin: 0; font-size: 15px; font-weight: 800; color: var(--vv-muted); }
.state > svg { flex: none; }
.state.overdue { color: var(--vv-negative-ink); }
.state.overdue > svg { color: var(--vv-negative); }
.state.dueSoon { color: var(--vv-goal); }
.state.paid > svg, .state.markedPaid > svg { color: var(--vv-accent); }

.facts { display: grid; gap: 12px; margin: 0; padding: 16px; border-radius: var(--vv-r-md); }
.facts div { display: grid; gap: 2px; }
.facts dt { font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--vv-muted); }
.facts dd { margin: 0; font-size: 15px; font-weight: 600; overflow-wrap: anywhere; }
.facts .big { font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; }
.facts .mono { font-variant-numeric: tabular-nums; }

.link-hint { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 13px; color: var(--vv-muted); }
.link-hint > svg { flex: none; color: var(--vv-accent); }

.actions { display: grid; gap: 12px; }
.row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
</style>
