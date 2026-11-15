<script setup lang="ts">
import { Plus, Minus, Pencil, Archive, Trash2, CircleCheck, Clock } from 'lucide-vue-next'
import { useGoalsStore, goalErrorMessage, type Goal } from '~/stores/goals'

/**
 * One goal in full, in a bottom sheet: progress, what to save per week, the
 * activity list (newest first, each entry deletable), and the actions
 * Add money · Take money out · Edit · Archive.
 *
 * The sheet only shows and asks; the page owns the other sheets, so Add /
 * Take out / Edit are emitted. `busy` = one of those is open on top of this
 * sheet, so Escape closes only the top one.
 */
const props = defineProps<{ goalId: string | null; busy?: boolean }>()
const emit = defineEmits<{ close: []; add: []; takeOut: []; edit: [] }>()

const i18n = useI18n()
const { t } = i18n
const { money, date } = useFormat()
const { toast } = useToast()
const store = useGoalsStore()

const goal = computed<Goal | null>(() => store.items.find((g) => g.id === props.goalId) ?? null)
const list = computed(() => (props.goalId ? store.contributions[props.goalId] : undefined))

const loadingList = ref(false)
const listError = ref('')

async function loadList() {
  if (!props.goalId) return
  loadingList.value = true
  listError.value = ''
  const ok = await store.fetchContributions(props.goalId)
  loadingList.value = false
  if (!ok) listError.value = store.failure ? goalErrorMessage(store.failure, i18n, money) : t('goals.err.generic')
}

// Always fetch fresh when opened (the list may be stale); the cached one shows meanwhile.
watch(() => props.goalId, (id) => { if (id) loadList() }, { immediate: true })

const open = computed({
  get: () => !!props.goalId && !!goal.value,
  set: (v: boolean) => { if (!v) emit('close') },
})

const dueText = computed(() =>
  goal.value?.dueDate
    ? t('goals.dueOn', { date: date(goal.value.dueDate, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) })
    : '',
)

function entryDate(iso: string) {
  // Entries are calendar days stored as UTC midnight - format as UTC so the day can't slide.
  return date(iso, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

// Both destructive actions ask first, in our own dialog (not the browser's confirm()).
type Pending = { kind: 'entry'; id: string; amountCents: number } | { kind: 'archive' }
const pending = ref<Pending | null>(null)
const confirming = ref(false)

const confirmCopy = computed(() => {
  const p = pending.value
  if (p?.kind === 'entry') {
    return { title: t('goals.removeTitle'), body: t('goals.removeConfirm', { amount: money(Math.abs(p.amountCents)) }), confirm: t('goals.removeAction') }
  }
  return { title: t('goals.archive'), body: t('goals.archiveConfirm', { name: goal.value?.name ?? '' }), confirm: t('goals.archive') }
})

async function runPending() {
  const p = pending.value
  const g = goal.value
  if (!p || !g || confirming.value) return
  confirming.value = true
  const ok = p.kind === 'entry' ? await store.removeContribution(g.id, p.id) : await store.archive(g.id)
  confirming.value = false
  pending.value = null
  if (ok) {
    toast(p.kind === 'entry' ? t('goals.entryRemoved') : t('goals.archived'))
    if (p.kind === 'archive') emit('close')
  } else {
    toast(store.failure ? goalErrorMessage(store.failure, i18n, money) : t('goals.err.generic'), 'bad')
  }
}
</script>

<template>
  <UiBottomSheet v-model="open" :title="goal?.name ?? t('goals.title')" :close-on-escape="!busy && !pending">
    <div v-if="goal" class="body">
      <section class="hero" :style="goalTintStyle(goalTint(goal))">
        <!-- What I'm saving for: the picture on the goal's tint, or its first letter. -->
        <div class="picture">
          <GoalPicture :src="goal.imageSrc" :name="goal.name" fit="cover" :focus-x="goal.imageFocusX" :focus-y="goal.imageFocusY" :zoom="goal.imageZoom" />
        </div>
        <p class="saved">{{ money(goal.savedCents) }}</p>
        <p class="of">{{ t('goals.of', { target: money(goal.targetCents) }) }} · {{ goal.percent }}%</p>
        <GoalProgressBar :percent="goal.percent" :label="t('goals.progressLabel', { name: goal.name })" />

        <p class="status" :class="{ done: goal.isReached }">
          <template v-if="goal.isReached">
            <CircleCheck :size="16" aria-hidden="true" />{{ t('goals.reached') }}
          </template>
          <template v-else-if="goal.isOverdue">
            <Clock :size="16" aria-hidden="true" />{{ t('goals.overdue', { amount: money(goal.remainingCents) }) }}
          </template>
          <template v-else-if="goal.neededPerWeekCents !== null && goal.weeksLeft !== null">
            {{ t('goals.perWeek', { amount: money(goal.neededPerWeekCents) }) }} ·
            {{ t('goals.weeksLeft', { n: goal.weeksLeft }, goal.weeksLeft) }}
          </template>
          <template v-else>{{ t('goals.toGo', { amount: money(goal.remainingCents) }) }}</template>
        </p>
        <p v-if="dueText" class="due">{{ dueText }}</p>
      </section>

      <div class="actions">
        <UiButton :icon="Plus" @click="emit('add')">{{ t('goals.add') }}</UiButton>
        <UiButton :icon="Minus" variant="ghost" :disabled="goal.savedCents <= 0" @click="emit('takeOut')">{{ t('goals.takeOut') }}</UiButton>
      </div>

      <section aria-labelledby="goal-activity">
        <h3 id="goal-activity">{{ t('goals.activity') }}</h3>

        <!-- Loading, with nothing cached yet -->
        <div v-if="loadingList && !list" class="skel-list" aria-hidden="true">
          <span class="skel" /><span class="skel" /><span class="skel" />
        </div>

        <!-- Error, with nothing to show -->
        <div v-else-if="listError && !list" class="err">
          <p class="vv-error" role="alert">{{ listError }}</p>
          <UiButton variant="ghost" :block="false" @click="loadList">{{ t('common.retry') }}</UiButton>
        </div>

        <p v-else-if="!list?.length" class="empty">{{ t('goals.noActivity') }}</p>

        <ul v-else class="entries" :aria-busy="loadingList || undefined">
          <li v-for="c in list" :key="c.id" class="entry">
            <span class="e-main">
              <span class="e-date">{{ entryDate(c.contributedAt) }}</span>
              <span v-if="c.note" class="e-note">{{ c.note }}</span>
            </span>
            <span class="vv-amount-out e-amount">{{ money(c.amountCents, { signed: true }) }}</span>
            <button
              type="button"
              class="e-del"
                            :aria-label="t('goals.removeEntry', { date: entryDate(c.contributedAt), amount: money(c.amountCents, { signed: true }) })"
              @click="pending = { kind: 'entry', id: c.id, amountCents: c.amountCents }"
            >
              <Trash2 :size="17" aria-hidden="true" />
            </button>
          </li>
        </ul>
      </section>

      <div class="manage">
        <UiButton :icon="Pencil" variant="ghost" @click="emit('edit')">{{ t('goals.edit') }}</UiButton>
        <UiButton :icon="Archive" variant="danger" @click="pending = { kind: 'archive' }">{{ t('goals.archive') }}</UiButton>
      </div>
    </div>

    <UiConfirmDialog
      :open="!!pending"
      :title="confirmCopy.title"
      :body="confirmCopy.body"
      :confirm-label="confirmCopy.confirm"
      :cancel-label="t('common.cancel')"
      destructive
      :loading="confirming"
      @confirm="runPending"
      @cancel="pending = null"
    />
  </UiBottomSheet>
</template>

<style scoped>
.body { display: grid; gap: 24px; }

.hero { display: grid; gap: 10px; }
.picture { height: 200px; margin-bottom: 6px; background: var(--g-bg); border-radius: var(--vv-r-md); box-shadow: var(--vv-p1); overflow: hidden; }
.saved { margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -.01em; font-variant-numeric: tabular-nums; }
.of { margin: 0; font-size: 14px; color: var(--vv-muted); font-variant-numeric: tabular-nums; }
.hero :deep(.track) { margin-top: 4px; }
.status { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin: 4px 0 0; font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; }
.status.done { color: var(--vv-goal); }
.due { margin: 0; font-size: 13px; color: var(--vv-muted); }

.actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.actions :deep(.btn) { padding: 0 12px; }

h3 { margin: 0 0 6px; font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--vv-muted); }
.empty { margin: 8px 0 0; font-size: 14px; color: var(--vv-muted); }
.err { display: grid; gap: 12px; justify-items: start; margin-top: 8px; }
.err .vv-error { margin: 0; width: 100%; }

/* Flat list with hairline dividers: this is data you scan. */
.entries { list-style: none; margin: 0; padding: 0; }
.entry { display: flex; align-items: center; gap: 10px; min-height: 56px; }
.entry + .entry { border-top: 1px solid var(--vv-shadow-dark); }
.e-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.e-date { font-size: 14px; font-weight: 600; }
.e-note { font-size: 13px; color: var(--vv-muted); overflow-wrap: anywhere; }
.e-amount { font-size: 15px; font-weight: 700; white-space: nowrap; }
.e-del {
  display: grid; place-items: center; flex: none; width: 44px; height: 44px; margin-right: -8px;
  color: var(--vv-muted-2); background: none; border: none; border-radius: var(--vv-r-badge); cursor: pointer;
}
.e-del:hover { color: var(--vv-text); }
.e-del:disabled { opacity: .5; cursor: progress; }
.e-del:focus-visible { outline: 2px solid var(--vv-accent-ring); outline-offset: 2px; }

.skel-list { display: grid; gap: 10px; margin-top: 10px; }
.skel { display: block; height: 44px; border-radius: var(--vv-r-sm); box-shadow: var(--vv-p1); animation: pulse 1.4s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: .55; } }
@media (prefers-reduced-motion: reduce) { .skel { animation: none; } }

.manage { display: grid; gap: 12px; }
</style>
