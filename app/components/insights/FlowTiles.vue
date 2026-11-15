<script setup lang="ts">
import { ArrowDownLeft, ArrowUpRight, Scale } from 'lucide-vue-next'
import { moneyCompact } from '~/utils/moneyCompact'

/**
 * In / Out / Net as three small cards side by side (Transactions only; Home keeps
 * MoneyTiles). Each: pastel icon disc + label, the amount, and a thin pressed bar
 * showing the size against income (In = full, Out = out/in, Net = |net|/in).
 *
 * The cards are ~100px wide on a 360px phone, so the amount can never wrap or
 * clip: it is one line, from 1.000 euro the cents are dropped, and the font
 * follows the card's width (container units, like MoneyTiles).
 *
 * Props are the insights totals: income >= 0, expense <= 0 (negative cents).
 */
const props = defineProps<{ incomeCents: number; expenseCents: number; netCents: number }>()
const { t } = useI18n()
const { localeTag } = useFormat()

/** A bar that has something in it is never thinner than this share, so it stays visible. */
const BAR_MIN_PCT = 4

/** share of income as a 0..100 width; no income -> full when there is something, else empty. */
function share(cents: number): number {
  const abs = Math.abs(cents)
  if (abs === 0) return 0
  if (props.incomeCents <= 0) return 100
  return Math.min(100, Math.max(BAR_MIN_PCT, (abs * 100) / props.incomeCents))
}

const tiles = computed(() => [
  {
    key: 'in', icon: ArrowDownLeft, tint: 'mint', label: t('home.in'),
    text: moneyCompact(props.incomeCents, localeTag.value, { signed: true }),
    amountClass: 'in', bar: props.incomeCents > 0 ? 100 : 0, barClass: 'in',
  },
  {
    key: 'out', icon: ArrowUpRight, tint: 'blush', label: t('home.out'),
    text: moneyCompact(props.expenseCents, localeTag.value),
    amountClass: 'out', bar: share(props.expenseCents), barClass: 'out',
  },
  {
    key: 'net', icon: Scale, tint: 'sky', label: t('home.net'),
    text: moneyCompact(props.netCents, localeTag.value, { signed: true }),
    amountClass: props.netCents < 0 ? 'out' : 'in', bar: share(props.netCents), barClass: props.netCents < 0 ? 'out' : 'in',
  },
])
</script>

<template>
  <div class="tiles">
    <div v-for="tile in tiles" :key="tile.key" class="neu-2 tile">
      <p class="top">
        <span class="disc" :style="goalTintStyle(tile.tint)" aria-hidden="true"><component :is="tile.icon" :size="12" /></span>
        <span class="label">{{ tile.label }}</span>
      </p>
      <p class="amount" :class="tile.amountClass" :style="{ '--len': tile.text.length }">{{ tile.text }}</p>
      <div class="bar" aria-hidden="true"><i :class="tile.barClass" :style="{ width: `${tile.bar}%` }" /></div>
    </div>
  </div>
</template>

<style scoped>
.tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.tile { padding: 12px 10px; min-width: 0; container-type: inline-size; }
.top { display: flex; align-items: center; gap: 6px; margin: 0; min-width: 0; }
.disc { display: grid; place-items: center; width: 22px; height: 22px; flex: none; border-radius: 50%; background: var(--g-bg); color: var(--g-ink); }
.label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; font-weight: 700; color: var(--vv-muted); }

/* Font = card content width / (characters x ~0.64em per bold tabular glyph), 9..15px. */
.amount {
  margin: 8px 0 0; white-space: nowrap; font-weight: 800; font-variant-numeric: tabular-nums;
  font-size: clamp(9px, calc(100cqi / (var(--len, 8) * 0.64)), 15px);
}
.amount.in { color: var(--vv-accent); }
.amount.out { color: var(--vv-negative); }

.bar { height: 6px; margin-top: 10px; border-radius: 6px; box-shadow: var(--vv-p1); overflow: hidden; }
.bar i { display: block; height: 100%; border-radius: 6px; }
.bar i.in { background: var(--vv-chart-in); }
.bar i.out { background: var(--vv-chart-out); }
</style>
