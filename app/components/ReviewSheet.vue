<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import { useCategoriesStore } from '~/stores/categories'
import { useTransactionsStore } from '~/stores/transactions'

/**
 * "Review N new transactions" - what the Shortcut parked, before it counts.
 *
 * Opens BY ITSELF when you open (or come back to) the app and something is
 * waiting: a Shortcut can't open a window inside the app, so the app checks
 * the moment you arrive. Everything starts checked; uncheck what shouldn't
 * go in. Unchecked rows are remembered and never offered again.
 * "Later" closes it - the rows keep waiting and Home keeps a reminder.
 */
const { t } = useI18n()
const { money, date } = useFormat()
const { toast } = useToast()
const { items, open, refresh } = usePending()
const categories = useCategoriesStore()
const txStore = useTransactionsStore()

// ---- When to look -----------------------------------------------------------
// On start, and every time the app comes back to the foreground (on iOS you
// run the Shortcut from the banking app, then switch back to Vibravault).
function onVisible() {
  if (document.visibilityState === 'visible' && !open.value) refresh(true)
}
onMounted(() => {
  refresh(true)
  document.addEventListener('visibilitychange', onVisible)
})
onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisible))

// Categories name/colour the suggestions; load them when the sheet opens.
watch(open, (isOpen) => { if (isOpen) categories.fetchAll() })

// ---- Selection ------------------------------------------------------------
// Everything starts checked. Rows that arrive while the sheet is open join
// checked; rows already there keep whatever you chose.
const selected = ref(new Set<string>())
const known = new Set<string>()
watch(items, (rows) => {
  for (const r of rows) {
    if (!known.has(r.id)) { known.add(r.id); selected.value.add(r.id) }
  }
  selected.value = new Set([...selected.value].filter((id) => rows.some((r) => r.id === id)))
}, { immediate: true })

function toggle(id: string) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}
function all(on: boolean) {
  selected.value = new Set(on ? items.value.map((r) => r.id) : [])
}

const keepCount = computed(() => items.value.filter((r) => selected.value.has(r.id)).length)
const removeCount = computed(() => items.value.length - keepCount.value)

// ---- Done -----------------------------------------------------------------
const busy = ref(false)
async function confirm() {
  if (busy.value || !items.value.length) return
  busy.value = true
  const keep = items.value.filter((r) => selected.value.has(r.id)).map((r) => r.id)
  const discard = items.value.filter((r) => !selected.value.has(r.id)).map((r) => r.id)
  try {
    const res = await $fetch<{ added: number; removed: number }>('/api/pending/resolve', {
      method: 'POST',
      body: { keep, discard },
    })
    open.value = false
    toast(t('review.done', { added: res.added, removed: res.removed }))
    // All three at once, not one after another: every refetch is a round
    // trip to the database, and Home should update as soon as possible.
    await Promise.all([refresh(), txStore.fetchMonth(), refreshNuxtData('dashboard')])
  } catch {
    toast(t('drawer.couldNotSave'), 'bad')
  } finally {
    busy.value = false
  }
}

function category(id: string | null) {
  return id ? categories.byId.get(id) : undefined
}
function tint(id: string | null) {
  const c = category(id)
  return c ? { background: `var(--vv-${c.color})`, color: `var(--vv-${c.color}-fg)` } : {}
}
</script>

<template>
  <UiBottomSheet v-model="open" :title="t('review.title', items.length)">
    <p class="intro">{{ t('review.intro') }}</p>

    <div class="bulk">
      <button type="button" class="link" @click="all(true)">{{ t('review.all') }}</button>
      <button type="button" class="link" @click="all(false)">{{ t('review.none') }}</button>
    </div>

    <ul class="list">
      <li v-for="r in items" :key="r.id">
        <label class="rv" :class="{ off: !selected.has(r.id) }">
          <input type="checkbox" class="sr" :checked="selected.has(r.id)" @change="toggle(r.id)" />
          <span class="box" aria-hidden="true"><Check v-if="selected.has(r.id)" :size="15" :stroke-width="3" /></span>
          <span class="tile neu" :style="tint(r.categoryId)" aria-hidden="true">
            <CategoryIcon :name="category(r.categoryId)?.icon" :size="17" />
          </span>
          <span class="main">
            <span class="name">{{ r.label }}</span>
            <span class="sub">
              {{ date(r.bookedAt, { weekday: 'short', day: 'numeric', month: 'short' }) }}
              <template v-if="category(r.categoryId)"> · {{ category(r.categoryId)!.name }}</template>
            </span>
          </span>
          <span class="amount" :class="r.amountCents > 0 ? 'vv-amount-in' : 'vv-amount-out'">
            {{ money(r.amountCents, { signed: r.amountCents > 0 }) }}
          </span>
        </label>
      </li>
    </ul>

    <!-- Stays in view while the list scrolls. -->
    <div class="actions">
      <p v-if="removeCount && keepCount" class="note">{{ t('review.willRemove', removeCount) }}</p>
      <UiButton v-if="keepCount" :loading="busy" @click="confirm">{{ t('review.add', keepCount) }}</UiButton>
      <UiButton v-else variant="danger" :loading="busy" @click="confirm">{{ t('review.removeAll') }}</UiButton>
      <UiButton variant="ghost" @click="open = false">{{ t('review.later') }}</UiButton>
    </div>
  </UiBottomSheet>
</template>

<style scoped>
.intro { margin: 0 0 12px; font-size: 14px; line-height: 1.5; color: var(--vv-muted); }
.bulk { display: flex; gap: 18px; margin-bottom: 6px; }
.link { padding: 6px 0; font: inherit; font-size: 14px; font-weight: 600; color: var(--vv-accent); background: none; border: none; cursor: pointer; }

.list { list-style: none; margin: 0; padding: 0; }
.list li + li { border-top: 1px solid var(--vv-shadow-dark); }
.rv { display: flex; align-items: center; gap: 12px; min-height: 62px; padding: 8px 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
/* Unchecked = going to be removed: stepped back, not hidden, so you can
   still see what you're saying no to. */
.rv.off .tile, .rv.off .main, .rv.off .amount { opacity: .45; }
.rv.off .name { text-decoration: line-through; }

.sr { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.box {
  display: grid; place-items: center; width: 26px; height: 26px; flex: none;
  color: var(--vv-accent-text); background: var(--vv-surface);
  border-radius: 8px; box-shadow: var(--vv-p1);
}
.rv:not(.off) .box { background: var(--vv-accent); box-shadow: var(--vv-e1); }
.sr:focus-visible + .box { outline: 2px solid var(--vv-accent-ring); outline-offset: 2px; }

.tile { display: grid; place-items: center; width: 38px; height: 38px; flex: none; font-size: 16px; color: var(--vv-muted); border-radius: var(--vv-r-sm); }
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.name { font-size: 15px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sub { font-size: 12px; color: var(--vv-muted); }
.amount { font-size: 15px; font-weight: 700; white-space: nowrap; }

.actions {
  position: sticky; bottom: calc(-24px - env(safe-area-inset-bottom)); z-index: 1;
  display: grid; gap: 10px; margin: 12px -22px 0; padding: 14px 22px calc(24px + env(safe-area-inset-bottom));
  background: var(--vv-surface);
}
.note { margin: 0; font-size: 13px; text-align: center; color: var(--vv-muted); }
</style>
