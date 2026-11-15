<script setup lang="ts">
import { useCategoriesStore } from '~/stores/categories'

/**
 * Home's budgets: plan vs actual for the month on screen, as small tiles two to a row
 * (up to six: three rows). One tile per category that has a monthly limit, the ones
 * closest to (or past) their limit first. Each tile is tinted in its category's own
 * pastel, with the icon, the amount left and a bar in that colour's ink. From 80% a
 * tile gets an amber ring, past the limit a coral one, and the words say the same
 * thing ("€40 left" / "€12 over"), so colour is never the only signal.
 *
 * With no limits set it shows one short hint that links to Categories, where
 * a limit is set per category.
 */
export interface BudgetLine { categoryId: string; spentCents: number; budgetCents: number }
const props = defineProps<{ budgets: BudgetLine[]; monthLabel?: string }>()

const { t } = useI18n()
const { money } = useFormat()
const categories = useCategoriesStore()

const MAX_TILES = 6
const WARN_AT = 0.8

const rows = computed(() =>
  props.budgets
    .map((b) => {
      const c = categories.byId.get(b.categoryId)
      if (!c || b.budgetCents <= 0) return null
      const ratio = b.spentCents / b.budgetCents
      const left = b.budgetCents - b.spentCents
      return {
        id: b.categoryId,
        name: c.name,
        icon: c.icon,
        color: c.color,
        ratio,
        state: ratio > 1 ? 'over' : ratio >= WARN_AT ? 'warn' : 'ok',
        width: Math.min(100, Math.max(ratio > 0 ? 2 : 0, ratio * 100)),
        spent: money(b.spentCents),
        limit: money(b.budgetCents),
        status: left >= 0 ? t('budgets.left', { amount: money(left) }) : t('budgets.over', { amount: money(-left) }),
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, MAX_TILES),
)
</script>

<template>
  <section class="budgets" aria-labelledby="budgets-h">
    <div class="head">
      <h2 id="budgets-h">{{ t('budgets.title') }}<span v-if="monthLabel" class="month">{{ monthLabel }}</span></h2>
      <NuxtLink class="vv-link more" to="/categories">{{ t('budgets.manage') }}</NuxtLink>
    </div>

    <ul v-if="rows.length" class="grid">
      <li v-for="r in rows" :key="r.id" class="tile neu" :class="r.state" :style="{ '--bg': `var(--vv-${r.color})`, '--ink': `var(--vv-${r.color}-fg)` }">
        <span class="top">
          <span class="icon" aria-hidden="true"><CategoryIcon :name="r.icon" :size="16" /></span>
          <span class="name">{{ r.name }}</span>
        </span>
        <span class="status">{{ r.status }}</span>
        <span
          class="bar"
          role="progressbar"
          :aria-label="t('budgets.barLabel', { name: r.name, spent: r.spent, limit: r.limit })"
          :aria-valuenow="Math.min(100, Math.round(r.ratio * 100))"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <span class="fill" :style="{ width: `${r.width}%` }" />
        </span>
        <span class="of">{{ t('budgets.of', { spent: r.spent, limit: r.limit }) }}</span>
      </li>
    </ul>
    <p v-else class="hint neu-3">{{ t('budgets.empty') }}</p>
  </section>
</template>

<style scoped>
.budgets { margin-bottom: 18px; }
.head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.head h2 { margin: 0; font-size: 16px; font-weight: 800; }
.month { margin-left: 8px; font-size: 13px; font-weight: 600; color: var(--vv-muted); }
.more { font-size: 14px; }
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 0; padding: 0; list-style: none; }

/* A tile wears its category's pastel; text, icon and bar use that pastel's ink (the same pair as the category tile). */
.tile {
  display: grid; gap: 6px; padding: 12px 12px 11px; min-width: 0;
  color: var(--ink); background: var(--bg); border-radius: var(--vv-r-md);
}
.top { display: flex; align-items: center; gap: 8px; min-width: 0; }
.icon { display: grid; place-items: center; flex: none; width: 26px; height: 26px; border-radius: 50%; background: color-mix(in srgb, var(--ink) 16%, transparent); }
.name { min-width: 0; font-size: 13px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.status { margin-top: 2px; font-size: 17px; font-weight: 800; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
.bar { display: block; height: 6px; border-radius: 999px; background: color-mix(in srgb, var(--ink) 18%, transparent); overflow: hidden; }
.fill { display: block; height: 100%; border-radius: 999px; background: var(--ink); transition: width .6s cubic-bezier(.22, 1, .36, 1); }
.of { font-size: 11px; font-weight: 600; opacity: .85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
/* How much is left shows as a ring round the tile, so it reads on any category colour. */
.warn { outline: 2px solid var(--vv-goal); outline-offset: -2px; }
.over { outline: 2px solid var(--vv-negative); outline-offset: -2px; }
.over .fill { background: var(--vv-negative); }
.hint { margin: 0; padding: 16px 20px; font-size: 14px; line-height: 1.45; color: var(--vv-muted); }
@media (prefers-reduced-motion: reduce) { .fill { transition: none; } }
</style>
