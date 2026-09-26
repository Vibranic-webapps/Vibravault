<script setup lang="ts">
import { formatCents } from '~~/shared/utils/money'
import { transactionLabel } from '~~/shared/utils/merchant'
import type { Transaction } from '~/stores/transactions'
import type { Category } from '~/stores/categories'

/**
 * Read-first detail view. Tapping a row used to open the edit form directly,
 * which is destructive by default: you meant to LOOK and landed in an editor
 * with fields you could change by accident. Actions now sit behind a
 * deliberate second tap.
 */
const props = defineProps<{
  transaction: Transaction | null
  category: Category | undefined
}>()

const emit = defineEmits<{
  close: []
  edit: [t: Transaction]
  remove: [t: Transaction]
}>()

const menuOpen = ref(false)

watch(() => props.transaction, () => { menuOpen.value = false })

function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (menuOpen.value) menuOpen.value = false
  else if (props.transaction) emit('close')
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const t = computed(() => props.transaction)
const isIncome = computed(() => (t.value?.amountCents ?? 0) > 0)
const isTransfer = computed(() => props.category?.kind === 'TRANSFER')

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

/** Only show rows that actually have something in them. */
const details = computed(() => {
  if (!t.value) return []
  const rows: { label: string; value: string; mono?: boolean }[] = [
    { label: 'Date', value: fullDate.value },
    { label: 'Category', value: props.category?.name ?? 'Uncategorised' },
  ]
  if (t.value.counterparty) rows.push({ label: 'Counterparty', value: t.value.counterparty })
  if (t.value.counterpartyIban) rows.push({ label: 'Account', value: t.value.counterpartyIban, mono: true })
  if (t.value.balanceAfterCents != null) {
    rows.push({ label: 'Balance after', value: formatCents(t.value.balanceAfterCents), mono: true })
  }
  rows.push({ label: 'Source', value: sourceLabel.value })
  return rows
})
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="t" class="scrim" @click.self="emit('close')">
        <div
          class="neu-4 sheet"
          role="dialog"
          aria-modal="true"
          :aria-label="transactionLabel(t.counterparty, t.description)"
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
                  <circle cx="9" cy="9"   r="1.6" fill="currentColor" />
                  <circle cx="9" cy="14.5" r="1.6" fill="currentColor" />
                </svg>
              </button>

              <div v-if="menuOpen" class="neu-2 menu" role="menu">
                <button class="menu-item" type="button" role="menuitem" @click="emit('edit', t!)">
                  <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M11.3 1.7a1.7 1.7 0 0 1 2.4 2.4l-8 8-3.2.8.8-3.2 8-8Z"
                          fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
                  </svg>
                  Edit
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

          <p class="amount" :class="isTransfer ? 'moved' : isIncome ? 'in' : 'out'">
            {{ formatCents(t.amountCents, { signed: isIncome }) }}
          </p>
          <p v-if="isTransfer" class="transfer-note">Between your own accounts — not income or spending</p>
          <p class="title">{{ transactionLabel(t.counterparty, t.description) }}</p>

          <dl class="details">
            <div v-for="d in details" :key="d.label" class="detail neu-divider">
              <dt>{{ d.label }}</dt>
              <dd :class="{ mono: d.mono }">{{ d.value }}</dd>
            </div>
          </dl>

          <!-- The raw bank text. The list label is truncated and heuristic, so
               the unedited original has to stay reachable somewhere. -->
          <details v-if="t.description" class="raw">
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
  padding: 14px 24px 24px;
  border-radius: var(--vv-r-lg) var(--vv-r-lg) 0 0;
}
/* Desktop: a centred panel rather than a sheet stuck to the bottom edge. */
@media (min-width: 600px) {
  .scrim { align-items: center; padding: 24px; }
  .sheet { border-radius: var(--vv-r-lg); padding-top: 20px; }
  .grab { display: none; }
}

.grab {
  width: 38px; height: 4px; margin: 0 auto 14px;
  border-radius: 999px; background: var(--vv-shadow-dark);
}

.top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.icon {
  display: grid; place-items: center; width: 46px; height: 46px; flex: none;
  border-radius: var(--vv-r-sm); font-size: 20px; color: var(--vv-muted-2);
}

.menu-wrap { position: relative; }
.menu-btn {
  width: 38px; height: 38px; display: grid; place-items: center;
  color: var(--vv-muted); background: var(--vv-surface);
  border: none; border-radius: var(--vv-r-badge);
  box-shadow: var(--vv-e1); cursor: pointer;
  transition: box-shadow .12s ease, color .12s ease;
}
.menu-btn:hover { color: var(--vv-text); }
.menu-btn[aria-expanded='true'] { box-shadow: var(--vv-p1); color: var(--vv-accent); }

.menu {
  position: absolute; top: 46px; right: 0; z-index: 2;
  min-width: 164px; padding: 6px;
  display: flex; flex-direction: column; gap: 2px;
}
.menu-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; width: 100%;
  font: inherit; font-size: 14px; font-weight: 600; text-align: left;
  color: var(--vv-text); background: none; border: none;
  border-radius: var(--vv-r-badge); cursor: pointer;
}
.menu-item:hover { box-shadow: var(--vv-p1); }
.menu-item.danger { color: var(--vv-negative); }

.amount {
  margin: 18px 0 2px; font-size: 34px; font-weight: 700;
  font-variant-numeric: tabular-nums; letter-spacing: -.01em;
}
.amount.in { color: var(--vv-accent); }
.amount.out { color: var(--vv-text); }
.amount.moved { color: var(--vv-muted); }
.transfer-note { margin: -2px 0 8px; font-size: 12px; font-weight: 600; color: var(--vv-muted-2); }
.title { margin: 0 0 20px; font-size: 15px; font-weight: 600; color: var(--vv-muted); }

.details { margin: 0; }
.detail { display: flex; justify-content: space-between; gap: 18px; padding: 12px 0; }
.detail:last-child { border-bottom: none; }
dt { font-size: 13px; color: var(--vv-muted); }
dd { margin: 0; font-size: 13px; font-weight: 600; text-align: right; }
dd.mono { font-family: ui-monospace, monospace; font-size: 12px; }

.raw { margin-top: 14px; font-size: 13px; }
.raw summary { cursor: pointer; color: var(--vv-muted); font-weight: 600; }
.raw p {
  margin: 10px 0 0; padding: 12px; font-size: 12px; line-height: 1.5;
  color: var(--vv-muted); word-break: break-word;
  border-radius: var(--vv-r-sm); box-shadow: var(--vv-p1);
}

.close { margin-top: 22px; }

/* Sheet rises from the bottom; on desktop the panel just fades with it. */
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
