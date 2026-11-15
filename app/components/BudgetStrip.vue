<script setup lang="ts">
import { useCategoriesStore } from '~/stores/categories'

/**
 * Home's budgets: plan vs actual for the month on screen. One row per category
 * that has a monthly limit, the ones closest to (or past) their limit first.
 * The bar sits in a pressed track and fills in the category's own colour; it
 * turns amber from 80% and coral once the limit is passed, and the words say
 * the same thing ("€40 left" / "€12 over"), so colour is never the only signal.
 *
 * With no limits set it shows one short hint that links to Categories, where
 * a limit is set per category.
 */
export interface BudgetLine { categoryId: string; spentCents: number; budgetCents: number }
const props = defineProps<{ budgets: BudgetLine[] }>()

const { t } = useI18n()
const { money } = useFormat()
const categories = useCategoriesStore()

const MAX_ROWS = 5
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
    .slice(0, MAX_ROWS),
)
</script>

<template>
  <section class="neu-3 card" aria-labelledby="budgets-h">
    <div class="head">
      <h2 id="budgets-h">{{ t('budgets.title') }}</h2>
      <NuxtLink class="vv-link more" to="/categories">{{ t('budgets.manage') }}</NuxtLink>
    </div>

    <ul v-if="rows.length" class="list">
      <li v-for="r in rows" :key="r.id" class="row" :class="r.state">
        <span
          class="tile neu"
          :style="{ background: `var(--vv-${r.color})`, color: `var(--vv-${r.color}-fg)` }"
          aria-hidden="true"
        >
          <CategoryIcon :name="r.icon" :size="18" />
        </span>
        <span class="main">
          <span class="top">
            <span class="name">{{ r.name }}</span>
            <span class="status">{{ r.status }}</span>
          </span>
          <span
            class="bar"
            role="progressbar"
            :aria-label="t('budgets.barLabel', { name: r.name, spent: r.spent, limit: r.limit })"
            :aria-valuenow="Math.min(100, Math.round(r.ratio * 100))"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <span class="fill" :style="{ width: `${r.width}%`, '--bar': `var(--vv-${r.color}-fg)` }" />
          </span>
          <span class="of">{{ t('budgets.of', { spent: r.spent, limit: r.limit }) }}</span>
        </span>
      </li>
    </ul>
    <p v-else class="hint">{{ t('budgets.empty') }}</p>
  </section>
</template>

<style scoped>
.head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.head h2 { margin: 0; font-size: 16px; font-weight: 800; }
.more { font-size: 14px; }
.list { display: grid; gap: 16px; margin: 0; padding: 0; list-style: none; }
.row { display: flex; align-items: flex-start; gap: 12px; }
.tile { display: grid; place-items: center; flex: none; width: 36px; height: 36px; border-radius: var(--vv-r-sm); }
.main { display: grid; flex: 1; gap: 6px; min-width: 0; }
.top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.name { min-width: 0; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.status { flex: none; font-size: 13px; font-weight: 700; color: var(--vv-muted); font-variant-numeric: tabular-nums; }
.warn .status { color: var(--vv-goal); }
.over .status { color: var(--vv-negative); }
.bar { display: block; height: 8px; border-radius: 999px; box-shadow: var(--vv-p1); overflow: hidden; }
.fill { display: block; height: 100%; border-radius: 999px; background: var(--bar); transition: width .6s cubic-bezier(.22, 1, .36, 1); }
.warn .fill { background: var(--vv-goal); }
.over .fill { background: var(--vv-negative); }
.of { font-size: 12px; color: var(--vv-muted); font-variant-numeric: tabular-nums; }
.hint { margin: 0; font-size: 14px; line-height: 1.45; color: var(--vv-muted); }
@media (prefers-reduced-motion: reduce) { .fill { transition: none; } }
</style>
