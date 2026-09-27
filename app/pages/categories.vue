<script setup lang="ts">
import { Plus, ChevronRight } from 'lucide-vue-next'
import { useCategoriesStore, type Category, type CategoryKind } from '~/stores/categories'

/**
 * Categories (Redesign v2, Wave 3): grouped rows - Spending, Income, Between
 * your accounts - each with its tile, name and how many transactions it
 * holds. Tap a row to edit it; "New category" opens the same sheet empty.
 */
const { t } = useI18n()
const store = useCategoriesStore()
await store.fetchAll(true) // counts change as transactions move - always fresh here

const GROUPS: CategoryKind[] = ['EXPENSE', 'INCOME', 'TRANSFER']

const sheetOpen = ref(false)
const editing = ref<Category | null>(null)
const newKind = ref<CategoryKind>('EXPENSE')

function openNew(kind: CategoryKind = 'EXPENSE') {
  editing.value = null
  newKind.value = kind
  sheetOpen.value = true
}
function openEdit(c: Category) {
  editing.value = c
  sheetOpen.value = true
}

function tint(c: Category) {
  return { background: `var(--vv-${c.color})`, color: `var(--vv-${c.color}-fg)` }
}
</script>

<template>
  <div>
    <header class="head">
      <h1>{{ t('cats.title') }}</h1>
      <UiIconButton :icon="Plus" :label="t('cats.new')" @click="openNew()" />
    </header>

    <section v-for="kind in GROUPS" :key="kind" class="group">
      <h2>{{ t(`cats.${kind}`) }}</h2>
      <p v-if="kind === 'TRANSFER'" class="note">{{ t('cats.transferNote') }}</p>

      <div class="neu-3 card">
        <button
          v-for="c in store.items.filter((x) => x.kind === kind)"
          :key="c.id"
          type="button"
          class="row"
          @click="openEdit(c)"
        >
          <span class="tile neu" :style="tint(c)" aria-hidden="true"><CategoryIcon :name="c.icon" :size="19" /></span>
          <span class="main">
            <span class="name">{{ c.name }}</span>
            <span v-if="c.count !== undefined" class="sub">{{ t('home.weekCount', c.count) }}</span>
          </span>
          <ChevronRight :size="18" class="chev" aria-hidden="true" />
        </button>
        <!-- New straight into this group: the type is already chosen. -->
        <button type="button" class="row add" @click="openNew(kind)">
          <span class="tile add-tile" aria-hidden="true"><Plus :size="19" /></span>
          <span class="main"><span class="name">{{ t('cats.new') }}</span></span>
        </button>
      </div>
    </section>

    <CategorySheet :open="sheetOpen" :category="editing" :default-kind="newKind" @close="sheetOpen = false" />
  </div>
</template>

<style scoped>
.head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 20px; }
h1 { margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -.01em; }
.group { margin-bottom: 22px; }
h2 { margin: 0 4px 10px; font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--vv-muted); }
.note { margin: -2px 4px 12px; font-size: 13px; line-height: 1.45; color: var(--vv-muted); }
.card { padding: 2px 16px; }
.empty { margin: 16px 0; font-size: 14px; color: var(--vv-muted); }

.row {
  display: flex; align-items: center; gap: 13px; width: 100%; min-height: 62px; padding: 8px 2px;
  font: inherit; text-align: left; color: var(--vv-text);
  background: none; border: none; cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.row + .row { border-top: 1px solid var(--vv-shadow-dark); }
.row:focus-visible { outline: 2px solid var(--vv-accent-ring); outline-offset: 2px; border-radius: 8px; }
.tile { display: grid; place-items: center; width: 42px; height: 42px; flex: none; border-radius: var(--vv-r-sm); }
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.name { font-size: 15px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sub { font-size: 12px; color: var(--vv-muted); }
.chev { color: var(--vv-muted-2); flex: none; }
.add .name { color: var(--vv-accent); }
.add-tile { color: var(--vv-accent); box-shadow: var(--vv-p1); }
</style>
