<script setup lang="ts">
import { formatCents, centsToInput } from '~~/shared/utils/money'
import { useTransactionsStore, type Transaction } from '~/stores/transactions'
import { useCategoriesStore } from '~/stores/categories'

const route = useRoute()
const store = useTransactionsStore()
const categories = useCategoriesStore()

await Promise.all([store.fetchMonth(), categories.fetchAll()])

const showForm = ref(false)
const editing = ref<Transaction | null>(null)
const saving = ref(false)

const form = reactive({
  direction: 'out' as 'in' | 'out',
  amount: '',
  bookedAt: new Date().toISOString().slice(0, 10),
  categoryId: '' as string,
  counterparty: '',
  description: '',
})

// The nav's + button links here with ?new=1.
onMounted(() => { if (route.query.new === '1') openCreate() })

const monthLabel = computed(() => {
  const [y, m] = store.month.split('-').map(Number)
  return new Date(y!, m! - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
})

function dayLabel(day: string) {
  return new Date(day).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function categoryOf(id: string | null) {
  return id ? categories.byId.get(id) : undefined
}

function openCreate() {
  editing.value = null
  Object.assign(form, {
    direction: 'out', amount: '',
    bookedAt: new Date().toISOString().slice(0, 10),
    categoryId: '', counterparty: '', description: '',
  })
  store.error = null
  showForm.value = true
}

function openEdit(t: Transaction) {
  editing.value = t
  Object.assign(form, {
    direction: t.amountCents < 0 ? 'out' : 'in',
    amount: centsToInput(t.amountCents),
    bookedAt: t.bookedAt.slice(0, 10),
    categoryId: t.categoryId ?? '',
    counterparty: t.counterparty ?? '',
    description: t.description ?? '',
  })
  store.error = null
  showForm.value = true
}

async function save() {
  saving.value = true
  // The SIGN is applied in exactly one place. If this conversion were repeated
  // at each call site, a positive expense would appear eventually.
  const signed = form.direction === 'out' ? `-${form.amount.replace(/^[-+]/, '')}` : form.amount
  const payload = {
    amount: signed,
    bookedAt: form.bookedAt,
    categoryId: form.categoryId || null,
    counterparty: form.counterparty || null,
    description: form.description || null,
  }
  const ok = editing.value ? await store.update(editing.value.id, payload) : await store.create(payload)
  saving.value = false
  if (ok) showForm.value = false
}

async function remove(t: Transaction) {
  if (!confirm('Delete this transaction?')) return
  await store.remove(t.id)
}

const formCategories = computed(() =>
  form.direction === 'in' ? categories.income : categories.expense,
)
watch(() => form.direction, () => { form.categoryId = '' })
</script>

<template>
  <div>
    <header class="head">
      <div>
        <h1>Transactions</h1>
        <p class="muted">
          {{ store.totals.count }} in {{ monthLabel }}
          <span v-if="store.uncategorisedCount"> · {{ store.uncategorisedCount }} uncategorised</span>
        </p>
      </div>
      <button class="add-btn" type="button" @click="openCreate">+ Add</button>
    </header>

    <!-- Month switcher + totals -->
    <div class="neu-3 summary">
      <div class="months">
        <button class="mbtn" type="button" aria-label="Previous month" @click="store.shiftMonth(-1)">‹</button>
        <span class="mlabel">{{ monthLabel }}</span>
        <button class="mbtn" type="button" aria-label="Next month" @click="store.shiftMonth(1)">›</button>
      </div>
      <div class="totals">
        <div><span class="tl">In</span><span class="vv-amount-in">{{ formatCents(store.totals.income, { signed: true }) }}</span></div>
        <div><span class="tl">Out</span><span class="vv-amount-neg">{{ formatCents(store.totals.expense) }}</span></div>
        <div><span class="tl">Net</span><span :class="store.totals.net < 0 ? 'vv-amount-neg' : 'vv-amount-in'">{{ formatCents(store.totals.net, { signed: true }) }}</span></div>
      </div>
    </div>

    <p v-if="store.error && !showForm" class="vv-error">{{ store.error }}</p>

    <div v-if="!store.items.length" class="neu-3 panel empty-panel">
      <p class="empty">Nothing in {{ monthLabel }}.</p>
      <button class="vv-btn narrow" type="button" @click="openCreate">Add your first transaction</button>
    </div>

    <!-- Data-dense: FLAT rows, hairline dividers, no shadows. -->
    <section v-for="[day, rows] in store.byDay" :key="day" class="day">
      <h2>{{ dayLabel(day) }}</h2>
      <div class="neu-3 panel">
        <div
          v-for="(t, i) in rows"
          :key="t.id"
          class="row"
          :class="{ 'neu-divider': i < rows.length - 1 }"
        >
          <span
            class="icon neu"
            :style="categoryOf(t.categoryId)
              ? { background: `var(--vv-${categoryOf(t.categoryId)!.color})`, color: `var(--vv-${categoryOf(t.categoryId)!.color}-fg)` }
              : {}"
            aria-hidden="true"
          >{{ categoryOf(t.categoryId)?.icon ?? '·' }}</span>

          <button class="row-main" type="button" @click="openEdit(t)">
            <strong>{{ t.counterparty || t.description || 'Transaction' }}</strong>
            <small>{{ categoryOf(t.categoryId)?.name ?? 'Uncategorised' }}</small>
          </button>

          <span :class="t.amountCents < 0 ? 'vv-amount-out' : 'vv-amount-in'">
            {{ formatCents(t.amountCents, { signed: t.amountCents > 0 }) }}
          </span>

          <button class="del" type="button" aria-label="Delete" @click="remove(t)">×</button>
        </div>
      </div>
    </section>

    <!-- Form -->
    <div v-if="showForm" class="overlay" @click.self="showForm = false">
      <div class="neu-3 form" role="dialog" aria-modal="true">
        <h2>{{ editing ? 'Edit transaction' : 'New transaction' }}</h2>
        <p v-if="store.error" class="vv-error">{{ store.error }}</p>

        <div class="kinds">
          <button
            v-for="d in (['out', 'in'] as const)"
            :key="d"
            type="button"
            class="kind"
            :class="{ on: form.direction === d }"
            @click="form.direction = d"
          >{{ d === 'out' ? 'Expense' : 'Income' }}</button>
        </div>

        <label class="vv-label spaced" for="amount">Amount</label>
        <input id="amount" v-model="form.amount" class="vv-field" inputmode="decimal" placeholder="42,18" />

        <label class="vv-label spaced" for="date">Date</label>
        <input id="date" v-model="form.bookedAt" class="vv-field" type="date" />

        <label class="vv-label spaced" for="cat">Category</label>
        <select id="cat" v-model="form.categoryId" class="vv-field">
          <option value="">Uncategorised</option>
          <option v-for="c in formCategories" :key="c.id" :value="c.id">{{ c.icon }} {{ c.name }}</option>
        </select>

        <label class="vv-label spaced" for="cp">Counterparty</label>
        <input id="cp" v-model="form.counterparty" class="vv-field" placeholder="Colruyt" />

        <label class="vv-label spaced" for="desc">Note</label>
        <input id="desc" v-model="form.description" class="vv-field" placeholder="Optional" />

        <div class="actions">
          <button class="vv-btn vv-btn--ghost" type="button" @click="showForm = false">Cancel</button>
          <button class="vv-btn" type="button" :disabled="saving || !form.amount.trim()" @click="save">
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 22px; }
h1 { margin: 0 0 4px; font-size: 26px; }
h2 { margin: 0 0 10px; font-size: 13px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--vv-muted-2); }
.muted { margin: 0; color: var(--vv-muted); font-size: 14px; }

.add-btn {
  padding: 11px 18px; font: inherit; font-size: 14px; font-weight: 600; white-space: nowrap;
  color: var(--vv-accent-text); background: var(--vv-accent);
  border: none; border-radius: var(--vv-r-badge); box-shadow: var(--vv-e1); cursor: pointer;
}
.add-btn:active { box-shadow: var(--vv-p1); }

.summary { padding: 18px 20px; margin-bottom: 26px; }
.months { display: flex; align-items: center; justify-content: center; gap: 14px; margin-bottom: 14px; }
.mbtn {
  width: 32px; height: 32px; font: inherit; font-size: 17px; line-height: 1;
  color: var(--vv-muted); background: var(--vv-surface);
  border: none; border-radius: var(--vv-r-badge); box-shadow: var(--vv-e1); cursor: pointer;
}
.mbtn:active { box-shadow: var(--vv-p1); }
.mlabel { font-size: 14px; font-weight: 700; min-width: 150px; text-align: center; }
.totals { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; text-align: center; }
.totals div { display: flex; flex-direction: column; gap: 2px; }
.tl { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--vv-muted-2); }
.totals span:last-child { font-size: 15px; font-weight: 700; }

.day { margin-bottom: 22px; }
.panel { padding: 6px 18px; }
.empty-panel { padding: 34px 24px; text-align: center; }
.empty { margin: 0 0 18px; color: var(--vv-muted-2); font-size: 14px; }
.narrow { max-width: 260px; margin: 0 auto; }

.row { display: flex; align-items: center; gap: 13px; padding: 12px 0; }
.icon {
  display: grid; place-items: center; width: 38px; height: 38px; flex: none;
  border-radius: var(--vv-r-sm); font-size: 17px; color: var(--vv-muted-2);
}
.row-main {
  display: flex; flex-direction: column; align-items: flex-start; gap: 1px;
  flex: 1; min-width: 0; padding: 0; background: none; border: none;
  font: inherit; text-align: left; cursor: pointer;
}
.row-main strong { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.row-main small { font-size: 12px; color: var(--vv-muted); }
.row span:not(.icon) { font-size: 14px; font-weight: 700; white-space: nowrap; }
.del {
  width: 26px; height: 26px; flex: none; font: inherit; font-size: 17px; line-height: 1;
  color: var(--vv-muted-2); background: none; border: none; border-radius: var(--vv-r-sm); cursor: pointer;
}
.del:hover { color: var(--vv-negative); }

.overlay {
  position: fixed; inset: 0; z-index: 40; display: grid; place-items: center;
  padding: 24px; background: rgba(0,0,0,.35); backdrop-filter: blur(2px); overflow-y: auto;
}
.form { width: 100%; max-width: 440px; padding: 28px; }
.spaced { margin-top: 16px; }
.kinds { display: flex; gap: 8px; }
.kind {
  flex: 1; padding: 11px; font: inherit; font-size: 14px; font-weight: 600;
  color: var(--vv-muted); background: var(--vv-surface);
  border: none; border-radius: var(--vv-r-sm); box-shadow: var(--vv-e1); cursor: pointer;
}
.kind.on { color: var(--vv-accent); box-shadow: var(--vv-p1); }
.actions { display: flex; gap: 10px; margin-top: 24px; }
</style>
