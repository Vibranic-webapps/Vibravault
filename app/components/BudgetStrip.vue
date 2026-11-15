<script setup lang="ts">
import { useCategoriesStore } from '~/stores/categories'

/**
 * Home's budgets: plan vs actual for the month on screen, as small SQUARE tiles four to a row
 * (up to six: two rows). One tile per category that has a monthly limit, the ones
 * closest to (or past) their limit first. Each tile is tinted in its category's own pastel
 * and the category icon is drawn huge and faint behind it. Reading order: the name (small),
 * the amount left (the big number), a slim bar, what was spent. From 80% a tile gets an
 * amber ring, past the limit a coral one, and the words say the same thing
 * ("€40 left" / "€12 over"), so colour is never the only signal.
 *
 * With no limits set it shows one short hint that links to Categories, where
 * a limit is set per category.
 */
export interface BudgetLine { categoryId: string; spentCents: number; budgetCents: number }
const props = defineProps<{ budgets: BudgetLine[]; monthLabel?: string }>()

const { t } = useI18n()
const { money, localeTag } = useFormat()

// Whole euros for the tile (it is tiny): what is left rounds DOWN and what is over rounds UP, so a tile never overstates.
const whole = (cents: number, mode: 'floor' | 'ceil' | 'round') =>
  new Intl.NumberFormat(localeTag.value, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
    .format(Math[mode](cents / 100)).replace(/\s/g, '')
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
        left: left >= 0 ? whole(left, 'floor') : whole(-left, 'ceil'),
        leftWord: left >= 0 ? t('budgets.leftWord') : t('budgets.overWord'),
        spentText: t('budgets.spent', { amount: whole(b.spentCents, 'round') }),
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
      <li v-for="r in rows" :key="r.id" class="tile neu" :class="r.state" :style="{ '--bg': `var(--vv-${r.color})`, '--ink': `var(--vv-${r.color}-fg)`, '--len': r.left.length + 3 }">
        <span class="bgicon" aria-hidden="true"><CategoryIcon :name="r.icon" :size="60" stroke-width="1.5" /></span>
        <span class="name">{{ r.name }}</span>
        <span class="bottom">
          <span class="left"><strong>{{ r.left }}</strong><small>{{ r.leftWord }}</small></span>
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
          <span class="of">{{ r.spentText }}</span>
        </span>
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
.grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin: 0; padding: 0; list-style: none; }

/* A small square tile wears its category's pastel; text and bar use that pastel's ink (the same pair as the category tile).
   The category icon is drawn big and faint in the bottom-right corner, cropped by the tile. Four fit in a row on a phone. */
.tile {
  position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; gap: 4px;
  aspect-ratio: 1; padding: 8px; min-width: 0; container-type: inline-size;
  color: var(--ink); background: var(--bg); border-radius: var(--vv-r-sm);
}
.bgicon { position: absolute; right: -12px; bottom: -14px; display: grid; opacity: .13; transform: rotate(-14deg); pointer-events: none; }
.name, .bottom { position: relative; }
.name { font-size: 10px; font-weight: 700; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bottom { display: grid; gap: 4px; }
.left { display: flex; align-items: baseline; gap: 3px; min-width: 0; white-space: nowrap; font-variant-numeric: tabular-nums; }
/* The hero number: one line, sized to the tile (characters x ~0.64em per bold glyph), 13-20px. */
.left strong { font-size: clamp(13px, calc(100cqi / (var(--len, 6) * 0.64)), 20px); font-weight: 800; line-height: 1; letter-spacing: -.02em; }
.left small { font-size: 9px; font-weight: 700; opacity: .8; }
.bar { display: block; height: 3px; border-radius: 999px; background: color-mix(in srgb, var(--ink) 18%, transparent); overflow: hidden; }
.fill { display: block; height: 100%; border-radius: 999px; background: var(--ink); transition: width .6s cubic-bezier(.22, 1, .36, 1); }
.of { font-size: 9px; font-weight: 700; line-height: 1.1; opacity: .8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
/* How much is left shows as a ring round the tile, so it reads on any category colour. */
.warn { outline: 2px solid var(--vv-goal); outline-offset: -2px; }
.over { outline: 2px solid var(--vv-negative); outline-offset: -2px; }
.over .fill { background: var(--vv-negative); }
.hint { margin: 0; padding: 16px 20px; font-size: 14px; line-height: 1.45; color: var(--vv-muted); }
@media (prefers-reduced-motion: reduce) { .fill { transition: none; } }
</style>
