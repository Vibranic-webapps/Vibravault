<script setup lang="ts">
/**
 * In / Out / Net for a period - the three tiles on Home and Transactions.
 *
 * Always ONE line per value, however big: each value's character count goes
 * to CSS as --len and the font sizes to the tile's width (container units),
 * clamped between 10 and 16px.
 */
const props = defineProps<{ income: number; expense: number; net: number }>()
const { t } = useI18n()
const { money } = useFormat()

const tiles = computed(() => [
  { key: 'in', label: t('home.in'), text: money(props.income, { signed: true }), cls: 'vv-amount-in' },
  { key: 'out', label: t('home.out'), text: money(props.expense), cls: 'vv-amount-out' },
  { key: 'net', label: t('home.net'), text: money(props.net, { signed: true }), cls: props.net < 0 ? 'vv-amount-out' : 'vv-amount-in' },
])
</script>

<template>
  <div class="tiles">
    <div v-for="tile in tiles" :key="tile.key" class="neu-3 tile">
      <p class="t-label">{{ tile.label }}</p>
      <p class="t-value" :class="tile.cls" :style="{ '--len': tile.text.length }">{{ tile.text }}</p>
    </div>
  </div>
</template>

<style scoped>
.tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.tile { padding: 14px 8px; text-align: center; container-type: inline-size; min-width: 0; }
.t-label { margin: 0 0 4px; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--vv-muted); }
/* Font = tile width / (characters x ~0.64em per bold tabular glyph). */
.t-value {
  margin: 0; white-space: nowrap; font-weight: 800; font-variant-numeric: tabular-nums;
  font-size: clamp(10px, calc(100cqi / (var(--len, 10) * 0.64)), 16px);
}
</style>
