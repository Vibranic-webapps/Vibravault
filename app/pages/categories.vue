<script setup lang="ts">
import { useCategoriesStore, type Category, type CategoryKind } from '~/stores/categories'

const store = useCategoriesStore()
await store.fetchAll()

const TINTS = Array.from({ length: 12 }, (_, i) => `cat-${i + 1}`)
const ICONS = ['💼','💰','🎁','🌴','🛒','🏠','💡','🚲','📺','🍽️','🛍️','💊','📦','☕','🎬','✈️','📱','🎓','🐾','🎵']

const editing = ref<Category | null>(null)
const showForm = ref(false)
const saving = ref(false)

const form = reactive<{ name: string; kind: CategoryKind; icon: string; color: string }>({
  name: '', kind: 'EXPENSE', icon: '📦', color: 'cat-1',
})

function openCreate() {
  editing.value = null
  Object.assign(form, { name: '', kind: 'EXPENSE', icon: '📦', color: 'cat-1' })
  store.error = null
  showForm.value = true
}

function openEdit(c: Category) {
  editing.value = c
  Object.assign(form, { name: c.name, kind: c.kind, icon: c.icon, color: c.color })
  store.error = null
  showForm.value = true
}

async function save() {
  saving.value = true
  const payload = { name: form.name, kind: form.kind, icon: form.icon, color: form.color }
  const ok = editing.value
    ? await store.update(editing.value.id, payload)
    : await store.create(payload)
  saving.value = false
  if (ok) showForm.value = false
}

async function remove(c: Category) {
  // Transactions survive as uncategorised - the relation is SetNull, so deleting
  // a category can never destroy financial history.
  if (!confirm(`Delete "${c.name}"? Transactions in it become uncategorised.`)) return
  await store.remove(c.id)
}
</script>

<template>
  <div>
    <header class="head">
      <div>
        <h1>Categories</h1>
        <p class="muted">Colour is identity — it lives in the icon tile only.</p>
      </div>
      <button class="add-btn" type="button" @click="openCreate">+ New</button>
    </header>

    <p v-if="store.error && !showForm" class="vv-error">{{ store.error }}</p>

    <section v-for="group in (['INCOME', 'EXPENSE'] as const)" :key="group" class="group">
      <h2>{{ group === 'INCOME' ? 'Income' : 'Expenses' }}</h2>

      <div class="neu-3 panel">
        <p v-if="!store.items.filter(c => c.kind === group).length" class="empty">
          No {{ group === 'INCOME' ? 'income' : 'expense' }} categories yet.
        </p>

        <div
          v-for="(c, i) in store.items.filter(x => x.kind === group)"
          :key="c.id"
          class="row"
          :class="{ 'neu-divider': i < store.items.filter(x => x.kind === group).length - 1 }"
        >
          <span
            class="icon neu"
            :style="{ background: `var(--${c.color})`, color: `var(--${c.color}-fg)` }"
            aria-hidden="true"
          >{{ c.icon }}</span>

          <span class="row-name">{{ c.name }}</span>

          <button class="link-btn" type="button" @click="openEdit(c)">Edit</button>
          <button class="link-btn danger" type="button" @click="remove(c)">Delete</button>
        </div>
      </div>
    </section>

    <!-- Form -->
    <div v-if="showForm" class="overlay" @click.self="showForm = false">
      <div class="neu-3 form" role="dialog" aria-modal="true" :aria-label="editing ? 'Edit category' : 'New category'">
        <h2>{{ editing ? 'Edit category' : 'New category' }}</h2>

        <p v-if="store.error" class="vv-error">{{ store.error }}</p>

        <label class="vv-label" for="cname">Name</label>
        <input id="cname" v-model="form.name" class="vv-field" maxlength="40" />

        <span class="vv-label spaced">Type</span>
        <div class="kinds">
          <button
            v-for="k in (['EXPENSE', 'INCOME'] as const)"
            :key="k"
            type="button"
            class="kind"
            :class="{ on: form.kind === k }"
            @click="form.kind = k"
          >{{ k === 'INCOME' ? 'Income' : 'Expense' }}</button>
        </div>

        <span class="vv-label spaced">Icon</span>
        <div class="icons">
          <button
            v-for="ic in ICONS"
            :key="ic"
            type="button"
            class="icon-pick"
            :class="{ on: form.icon === ic }"
            @click="form.icon = ic"
          >{{ ic }}</button>
        </div>

        <span class="vv-label spaced">Colour</span>
        <div class="tints">
          <button
            v-for="t in TINTS"
            :key="t"
            type="button"
            class="tint"
            :class="{ on: form.color === t }"
            :style="{ background: `var(--vv-${t})` }"
            :aria-label="t"
            @click="form.color = t"
          />
        </div>

        <div class="actions">
          <button class="vv-btn vv-btn--ghost" type="button" @click="showForm = false">Cancel</button>
          <button class="vv-btn" type="button" :disabled="saving || !form.name.trim()" @click="save">
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 26px; }
h1 { margin: 0 0 4px; font-size: 26px; }
h2 { margin: 0 0 10px; font-size: 15px; color: var(--vv-muted); }
.muted { margin: 0; color: var(--vv-muted); font-size: 14px; }

.add-btn {
  padding: 11px 18px; font: inherit; font-size: 14px; font-weight: 600;
  color: var(--vv-accent-text); background: var(--vv-accent);
  border: none; border-radius: var(--vv-r-badge); box-shadow: var(--vv-e1); cursor: pointer;
  white-space: nowrap;
}
.add-btn:active { box-shadow: var(--vv-p1); }

.group { margin-bottom: 30px; }
.panel { padding: 8px 20px; }
.empty { color: var(--vv-muted-2); font-size: 14px; padding: 14px 0; margin: 0; }

/* Data-dense: flat rows, hairline dividers. No shadows. */
.row { display: flex; align-items: center; gap: 14px; padding: 13px 0; }
.icon { display: grid; place-items: center; width: 40px; height: 40px; border-radius: var(--vv-r-sm); font-size: 18px; flex: none; }
.row-name { flex: 1; font-size: 15px; font-weight: 600; }

.link-btn {
  padding: 6px 10px; font: inherit; font-size: 13px; font-weight: 600;
  color: var(--vv-muted); background: none; border: none; border-radius: var(--vv-r-sm); cursor: pointer;
}
.link-btn:hover { color: var(--vv-text); }
.link-btn.danger:hover { color: var(--vv-negative); }

.overlay {
  position: fixed; inset: 0; z-index: 40;
  display: grid; place-items: center; padding: 24px;
  background: rgba(0,0,0,.35); backdrop-filter: blur(2px);
  overflow-y: auto;
}
.form { width: 100%; max-width: 440px; padding: 28px; }
.spaced { margin-top: 18px; }

.kinds { display: flex; gap: 8px; }
.kind {
  flex: 1; padding: 11px; font: inherit; font-size: 14px; font-weight: 600;
  color: var(--vv-muted); background: var(--vv-surface);
  border: none; border-radius: var(--vv-r-sm); box-shadow: var(--vv-e1); cursor: pointer;
}
.kind.on { color: var(--vv-accent); box-shadow: var(--vv-p1); }

.icons { display: flex; flex-wrap: wrap; gap: 7px; }
.icon-pick {
  width: 40px; height: 40px; font-size: 18px; line-height: 1;
  background: var(--vv-surface); border: none; border-radius: var(--vv-r-sm);
  box-shadow: var(--vv-e1); cursor: pointer;
}
.icon-pick.on { box-shadow: var(--vv-p1); }

.tints { display: flex; flex-wrap: wrap; gap: 8px; }
.tint {
  width: 34px; height: 34px; border: none; border-radius: var(--vv-r-sm);
  box-shadow: var(--vv-e1); cursor: pointer;
}
.tint.on { box-shadow: var(--vv-p1), 0 0 0 2px var(--vv-accent-ring); }

.actions { display: flex; gap: 10px; margin-top: 26px; }
</style>
