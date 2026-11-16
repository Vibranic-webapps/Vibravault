<script setup lang="ts">
import { Plus, Repeat } from 'lucide-vue-next'
import { useRecurringStore, type Occ, type RecurringItem } from '~/stores/recurring'
import { useCategoriesStore } from '~/stores/categories'

/**
 * Recurring bills + income. Grouped so the first thing you see is what needs you:
 * overdue first, then the next bills, then income, then paused ones.
 * Tapping a row opens its detail sheet (mark paid, skip, edit, pause, delete).
 */
const { t } = useI18n()
const store = useRecurringStore()
const categories = useCategoriesStore()

// Opens at once on what the store already holds, then refreshes (see useScreenData).
// Suggestions load beside the list and never block it (their fetch cannot fail loudly).
useScreenData(() => Promise.all([store.fetchAll(true), categories.fetchAll(), store.fetchSuggestions(true)]))

onPullRefresh(async () => {
  await Promise.all([store.fetchAll(true), store.fetchSuggestions(true)])
  if (store.error) throw new Error('refresh failed')
})

const byDue = (a: RecurringItem, b: RecurringItem) =>
  (a.next?.dueOn ?? '9999').localeCompare(b.next?.dueOn ?? '9999')

const active = computed(() => store.items.filter((i) => i.active))
const groups = computed(() => [
  { key: 'attention', items: active.value.filter((i) => i.next?.state === 'overdue').sort(byDue) },
  { key: 'comingUp', items: active.value.filter((i) => i.direction === 'OUT' && i.next?.state !== 'overdue').sort(byDue) },
  { key: 'income', items: active.value.filter((i) => i.direction === 'IN' && i.next?.state !== 'overdue').sort(byDue) },
  { key: 'paused', items: store.items.filter((i) => !i.active).sort((a, b) => a.name.localeCompare(b.name)) },
].filter((g) => g.items.length))

// ---- Sheets ------------------------------------------------------------------
const detailOpen = ref(false)
const selectedId = ref<string | null>(null)
const selectedOcc = ref<Occ | null>(null)
const addOpen = ref(false)

function openItem(it: RecurringItem) {
  selectedId.value = it.id
  selectedOcc.value = it.active ? it.next : null
  detailOpen.value = true
}
</script>

<template>
  <div>
    <SubPageHeader :title="t('recurring.title')" back="/you" />
    <p class="intro">{{ t('recurring.intro') }}</p>

    <!-- Spotted patterns: above everything, also when there are no items yet. Renders nothing when empty. -->
    <RecurringSuggestions />

    <!-- First load: skeleton instead of a blank page. -->
    <div v-if="!store.loaded && store.loading" class="skels" aria-hidden="true">
      <span class="neu-3 skel" /><span class="neu-3 skel short" />
    </div>

    <!-- The list could not be loaded and we have nothing to show. -->
    <section v-else-if="!store.loaded && store.error" class="neu-3 state" role="alert">
      <p>{{ t('recurring.loadError') }}</p>
      <UiButton :block="false" @click="store.fetchAll(true)">{{ t('common.retry') }}</UiButton>
    </section>

    <!-- Empty: teach what this is for in one line. -->
    <section v-else-if="!store.items.length" class="neu-3 state">
      <UiIconTile :icon="Repeat" size="lg" />
      <p>{{ t('recurring.empty') }}</p>
      <UiButton :icon="Plus" :block="false" @click="addOpen = true">{{ t('recurring.add') }}</UiButton>
    </section>

    <template v-else>
      <UiButton class="add" :icon="Plus" variant="ghost" @click="addOpen = true">{{ t('recurring.add') }}</UiButton>

      <section v-for="g in groups" :key="g.key" class="group" :aria-labelledby="`rg-${g.key}`">
        <h2 :id="`rg-${g.key}`">{{ t(`recurring.group.${g.key}`) }}</h2>
        <ul class="neu-3 recurring-list">
          <RecurringRow
            v-for="it in g.items"
            :key="it.id"
            :name="it.name"
            :direction="it.direction"
            :cadence="it.cadence"
            :state="it.active ? (it.next?.state ?? 'upcoming') : 'paused'"
            :occ="it.active ? it.next : null"
            :amount-min-cents="it.amountMinCents"
            :amount-max-cents="it.amountMaxCents"
            @open="openItem(it)"
          />
        </ul>
      </section>

      <p v-if="store.error" class="vv-error" role="alert">{{ t('recurring.refreshError') }}</p>
    </template>

    <RecurringDetailSheet v-model="detailOpen" :item-id="selectedId" :occ="selectedOcc" />
    <RecurringFormSheet v-model="addOpen" />
  </div>
</template>

<style scoped>
.intro { margin: 0 0 20px; font-size: 15px; line-height: 1.5; color: var(--vv-muted); }
.add { margin-bottom: 20px; }
.group { margin-bottom: 22px; }
h2 { margin: 0 0 10px 4px; font-size: 13px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--vv-muted); }
.recurring-list { list-style: none; margin: 0; padding: 2px 16px; }

.state { display: grid; justify-items: center; gap: 14px; padding: 30px 22px; text-align: center; }
.state p { margin: 0; color: var(--vv-muted); line-height: 1.5; }

.skels { display: grid; gap: 18px; }
.skel { display: block; height: 176px; animation: pulse 1.4s ease-in-out infinite; }
.skel.short { height: 128px; }
@keyframes pulse { 50% { opacity: .6; } }
@media (prefers-reduced-motion: reduce) { .skel { animation: none; } }
</style>
