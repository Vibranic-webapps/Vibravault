<script setup lang="ts">
import { Check, Clock, Plus, Tag } from 'lucide-vue-next'
import { useRecurringStore, type RecurringSuggestion } from '~/stores/recurring'
import { useRecurringText } from './recurringText'

/**
 * "Looks recurring": patterns the server spotted in the bank rows, one raised card each
 * with Add and Not now. At most MAX_SHOWN at a time; handling one brings the next in.
 * After a choice the card turns into a pressed-in confirmation line for a few seconds.
 * Renders nothing when there is nothing to show.
 */
const MAX_SHOWN = 3
/** How long a confirmation line stays before the next suggestion takes its place. */
const DONE_MS = 5000

const { t, te } = useI18n()
const store = useRecurringStore()
const { amountText, cadenceShort, shortDate } = useRecurringText()

interface Done {
  key: string
  kind: 'added' | 'later'
  text: string
}

/** Confirmation lines, oldest first. They count against MAX_SHOWN so the block never grows. */
const done = ref<Done[]>([])
/** Which suggestion has a request running, and which button started it. */
const busy = ref<Record<string, 'add' | 'later' | undefined>>({})
/** Error text per suggestion key, shown inside its card. */
const errors = ref<Record<string, string | undefined>>({})
const timers = new Set<ReturnType<typeof setTimeout>>()

const cards = computed(() => store.suggestions.slice(0, Math.max(0, MAX_SHOWN - done.value.length)))
const visible = computed(() => done.value.length > 0 || cards.value.length > 0)

function title(s: RecurringSuggestion): string {
  return t(s.direction === 'IN' ? 'recurring.suggest.titleIn' : 'recurring.suggest.titleOut', {
    name: s.name,
    amount: amountText(s.amountMinCents, s.amountMaxCents, s.direction),
    cadence: cadenceShort(s.cadence),
  })
}

/** "Seen on 3 Sep, 3 Oct and 3 Nov", for 1 to 3 dates. */
function seen(s: RecurringSuggestion): string {
  const d = s.seenOn.slice(0, 3).map(shortDate)
  if (d.length === 0) return ''
  if (d.length === 1) return t('recurring.suggest.seen1', { a: d[0] })
  if (d.length === 2) return t('recurring.suggest.seen2', { a: d[0], b: d[1] })
  return t('recurring.suggest.seen3', { a: d[0], b: d[1], c: d[2] })
}

function errorText(code: string | null): string {
  const key = code ? `recurring.error.${code}` : ''
  return key && te(key) ? t(key) : t('recurring.error.generic')
}

function showDone(entry: Done) {
  done.value = [...done.value, entry]
  const timer = setTimeout(() => {
    timers.delete(timer)
    done.value = done.value.filter((d) => d !== entry)
  }, DONE_MS)
  timers.add(timer)
}
onBeforeUnmount(() => timers.forEach(clearTimeout))

async function add(s: RecurringSuggestion) {
  if (busy.value[s.key]) return
  busy.value = { ...busy.value, [s.key]: 'add' }
  errors.value = { ...errors.value, [s.key]: undefined }
  const item = await store.addSuggestion(s)
  busy.value = { ...busy.value, [s.key]: undefined }
  if (!item) {
    // Keep the card so the user can retry or dismiss.
    errors.value = { ...errors.value, [s.key]: errorText(store.failure?.code ?? null) }
    return
  }
  const next = item.next?.dueOn
  showDone({
    key: s.key,
    kind: 'added',
    text: next
      ? t('recurring.suggest.added', { name: item.name, date: shortDate(next) })
      : t('recurring.suggest.addedNoDate', { name: item.name }),
  })
}

async function later(s: RecurringSuggestion) {
  if (busy.value[s.key]) return
  busy.value = { ...busy.value, [s.key]: 'later' }
  errors.value = { ...errors.value, [s.key]: undefined }
  // The store hides the card at once; when the server refuses it is put back.
  const entry: Done = { key: s.key, kind: 'later', text: t('recurring.suggest.askAgain') }
  showDone(entry)
  const ok = await store.dismissSuggestion(s.key)
  busy.value = { ...busy.value, [s.key]: undefined }
  if (!ok) {
    done.value = done.value.filter((d) => d !== entry)
    errors.value = { ...errors.value, [s.key]: t('recurring.suggest.laterError') }
  }
}
</script>

<template>
  <section v-if="visible" class="sugg-block" aria-labelledby="rs-heading">
    <h2 id="rs-heading">{{ t('recurring.suggest.heading') }}</h2>

    <!-- Confirmation lines: pressed in, announced politely. -->
    <p v-for="d in done" :key="`done-${d.key}-${d.kind}`" class="done" role="status">
      <component :is="d.kind === 'added' ? Check : Clock" :size="18" :stroke-width="2.6" aria-hidden="true" />
      <span>{{ d.text }}</span>
    </p>

    <article v-for="s in cards" :key="s.key" class="neu-3 sugg">
      <div class="top">
        <span class="disc" aria-hidden="true"><Tag :size="20" :stroke-width="2.2" /></span>
        <div class="txt">
          <p class="ttl">{{ title(s) }}</p>
          <p v-if="seen(s)" class="seen">{{ seen(s) }}</p>
        </div>
      </div>

      <p v-if="errors[s.key]" class="vv-error" role="alert">{{ errors[s.key] }}</p>

      <div class="btns">
        <UiButton :icon="Plus" :loading="busy[s.key] === 'add'" :disabled="!!busy[s.key]" @click="add(s)">
          {{ t('recurring.suggest.add') }}
        </UiButton>
        <UiButton variant="ghost" :loading="busy[s.key] === 'later'" :disabled="!!busy[s.key]" @click="later(s)">
          {{ t('recurring.suggest.later') }}
        </UiButton>
      </div>
    </article>
  </section>
</template>

<style scoped>
.sugg-block { display: grid; gap: 12px; margin-bottom: 22px; }
h2 { margin: 0 0 -2px 4px; font-size: 13px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--vv-muted); }

.sugg { display: grid; gap: 12px; padding: 14px; min-width: 0; }
.top { display: flex; gap: 12px; align-items: center; min-width: 0; }
/* The tint lives INSIDE the raised card, as the design system asks. */
.disc {
  flex: none; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%;
  background: var(--vv-tint-lavender); color: var(--vv-tint-lavender-fg);
}
.txt { min-width: 0; }
.ttl { margin: 0; font-size: 15px; font-weight: 700; line-height: 1.35; overflow-wrap: anywhere; }
.seen { margin: 2px 0 0; font-size: 12.5px; color: var(--vv-muted); }
.btns { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.btns :deep(.btn) { padding: 0 12px; }

.done {
  display: flex; gap: 10px; align-items: center; margin: 0; padding: 12px 14px;
  border-radius: var(--vv-r-md); box-shadow: var(--vv-p2); font-size: 14px; overflow-wrap: anywhere;
}
.done > svg { flex: none; }
</style>
