<script setup lang="ts">
import { ArrowDown, ArrowUp } from 'lucide-vue-next'
import type { Occ, RecurringCadence, RecurringDirection } from '~/stores/recurring'
import { STATE_ICON, type RowState, useRecurringText } from './recurringText'

/**
 * One recurring bill / income as a flat list row: a date stone (day + month),
 * the name, the state in words AND an icon, and the amount. Used on Home and on
 * the Recurring page, so both always look and read the same.
 *
 * Settled (paid / skipped) = the stone is pushed IN; open = it stays raised.
 * Overdue gets a coral outline + words. Income has a + sign, a down arrow and
 * the word "Income", so it is never told apart by colour alone.
 * Renders an <li>: put it inside a <ul class="recurring-list">.
 */
const props = defineProps<{
  name: string
  direction: RecurringDirection
  cadence: RecurringCadence
  state: RowState
  /** The occurrence shown (null for a paused item). */
  occ: Occ | null
  /** Fixed amount: both equal. */
  amountMinCents: number
  amountMaxCents: number
}>()
const emit = defineEmits<{ open: [] }>()

const { stone, longDate, stateText, amountText, cadenceShort, kindWord } = useRecurringText()
const { t } = useI18n()

const parts = computed(() => stone(props.occ?.dueOn ?? null))
const status = computed(() => stateText(props.state, props.direction, props.occ))
const amount = computed(() => amountText(props.amountMinCents, props.amountMaxCents, props.direction))
const settled = computed(() => props.state === 'paid' || props.state === 'markedPaid' || props.state === 'skipped')
const StateIcon = computed(() => STATE_ICON[props.state])

const label = computed(() =>
  [
    props.name,
    kindWord(props.direction),
    amount.value,
    status.value,
    props.occ ? t('recurring.dueOn', { date: longDate(props.occ.dueOn) }) : '',
  ].filter(Boolean).join(', '),
)
</script>

<template>
  <li>
    <button
      type="button"
      class="irow"
      :class="[state, { settled }]"
      :aria-label="label"
      @click="emit('open')"
    >
      <span class="stone" aria-hidden="true">
        <b>{{ parts.day }}</b>
        <small>{{ parts.month }}</small>
      </span>

      <span class="mid">
        <span class="nm">{{ name }}</span>
        <span class="sb">
          <component :is="direction === 'IN' ? ArrowDown : ArrowUp" :size="13" :stroke-width="2.6" aria-hidden="true" />
          {{ kindWord(direction) }}, {{ cadenceShort(cadence) }}
        </span>
      </span>

      <span class="rt">
        <span class="amt" :class="{ in: direction === 'IN' && !settled, dim: settled }">{{ amount }}</span>
        <span class="st" :class="state">
          <component :is="StateIcon" :size="14" :stroke-width="2.6" aria-hidden="true" />
          {{ status }}
        </span>
      </span>
    </button>
  </li>
</template>

<style scoped>
li + li { border-top: 1px solid var(--vv-shadow-dark); }

.irow {
  display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; gap: 12px; align-items: center;
  width: 100%; min-height: 64px; padding: 10px 0;
  font: inherit; color: inherit; text-align: left; background: none; border: 0; cursor: pointer;
}
.irow:focus-visible { outline: 2px solid var(--vv-accent-ring); outline-offset: 2px; border-radius: var(--vv-r-sm); }

/* The date stone: a small raised tile, pushed in once the bill is settled. */
.stone {
  display: grid; place-content: center; width: 44px; height: 48px;
  text-align: center; line-height: 1.05;
  background: var(--vv-surface); border-radius: var(--vv-r-sm); box-shadow: var(--vv-e1);
}
.stone b { font-size: 17px; font-weight: 800; }
.stone small { font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--vv-muted); }
.irow.settled .stone { box-shadow: var(--vv-p1); }
.irow.overdue .stone { outline: 2px solid var(--vv-negative); outline-offset: -2px; }

.mid { min-width: 0; }
.nm { display: block; font-size: 15px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.irow.settled .nm, .irow.paused .nm { font-weight: 600; color: var(--vv-muted); }
.sb {
  display: flex; align-items: center; gap: 4px; margin-top: 1px;
  font-size: 12.5px; color: var(--vv-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
/* A bare "svg" would also hit child-component icons, so always go through the parent. */
.sb > svg { flex: none; }

.rt { display: grid; justify-items: end; gap: 3px; }
.amt { font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; }
.amt.in { color: var(--vv-accent); }
.amt.dim { color: var(--vv-muted); }

.st { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; color: var(--vv-muted); white-space: nowrap; }
.st > svg { flex: none; }
.st.overdue { color: var(--vv-negative-ink); }
.st.overdue > svg { color: var(--vv-negative); }
.st.dueSoon { color: var(--vv-goal); }
.st.paid > svg, .st.markedPaid > svg { color: var(--vv-accent); }

@media (max-width: 380px) {
  .irow { gap: 10px; }
  .amt { font-size: 14px; }
}
</style>
