<script setup lang="ts">
import { Landmark } from 'lucide-vue-next'

/**
 * One bank account as a card you hold - the first thing on Home.
 * The balance is what's IN the account: the bank's own Saldo from the newest
 * import (+ anything typed by hand since). The footer says where the number
 * comes from, so an old import is visible instead of silently wrong.
 * Solid accent colour from the locked palette (no gradients). The rings in
 * the corner are the same colour at low opacity: depth without new colours.
 */
interface Props {
  name: string
  balanceCents: number
  fromBank: boolean
  asOf: string | null
  addedSince: number
}
const props = defineProps<Props>()
const { t } = useI18n()
const { money, date } = useFormat()

const updated = computed(() => {
  if (!props.asOf) return t('home.noActivity')
  const when = date(props.asOf, { day: 'numeric', month: 'short' })
  if (!props.fromBank) return t('home.lastActivity', { date: when })
  const base = t('home.bankOn', { date: when })
  return props.addedSince ? `${base} · ${t('home.plusManual', props.addedSince)}` : base
})
</script>

<template>
  <article class="bank-card" :aria-label="`${name}: ${money(balanceCents)}`">
    <span class="ring r1" aria-hidden="true" />
    <span class="ring r2" aria-hidden="true" />

    <header class="top">
      <span class="name">{{ name }}</span>
      <Landmark :size="20" aria-hidden="true" />
    </header>

    <div class="mid">
      <p class="label">{{ t('home.balance') }}</p>
      <p class="value">{{ money(balanceCents) }}</p>
    </div>

    <p class="foot">{{ updated }}</p>
  </article>
</template>

<style scoped>
.bank-card {
  position: relative; overflow: hidden; isolation: isolate;
  display: flex; flex-direction: column; justify-content: space-between;
  min-height: 188px; padding: 22px 24px;
  color: var(--vv-accent-text); background: var(--vv-accent);
  border-radius: var(--vv-r-lg); box-shadow: var(--vv-e3);
}
.ring {
  position: absolute; z-index: -1; border-radius: 50%;
  border: 28px solid currentColor; opacity: .07;
}
.r1 { width: 260px; height: 260px; right: -90px; top: -110px; }
.r2 { width: 180px; height: 180px; right: -40px; bottom: -120px; }

.top { display: flex; align-items: center; justify-content: space-between; gap: 12px; opacity: .92; }
.name { font-size: 15px; font-weight: 700; letter-spacing: .02em; }

.label { margin: 0 0 2px; font-size: 12px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; opacity: .8; }
.value {
  margin: 0; font-size: clamp(28px, 9vw, 38px); font-weight: 800; letter-spacing: -.02em;
  font-variant-numeric: tabular-nums; white-space: nowrap;
}
.foot { margin: 0; font-size: 12px; font-weight: 500; opacity: .8; }
</style>
