<script setup lang="ts">
/**
 * "Your subscriptions": one compact full-width card with a line per
 * subscription (iCloud, Spotify...), biggest first. It used to sit inside the
 * subscriptions ring; the half-width ring card has no room for it.
 *
 * Nothing flagged in this period: no card, just a one-line nudge to mark a
 * category as a subscription.
 */
interface Props {
  subscriptions: { totalCents: number; items: { label: string; totalCents: number; count: number }[] }
}
const props = defineProps<Props>()
const { t } = useI18n()
const { money } = useFormat()

/** How many subscription lines are listed. */
const ITEMS_SHOWN = 5

const topItems = computed(() => props.subscriptions.items.slice(0, ITEMS_SHOWN))
const hasSubscriptions = computed(() => props.subscriptions.totalCents > 0)
</script>

<template>
  <section v-if="topItems.length" class="neu-3 card" :aria-label="t('insights.subsTop')">
    <h2>{{ t('insights.subsTop') }}</h2>
    <ul>
      <li v-for="item in topItems" :key="item.label">
        <span class="name">{{ item.label }}</span>
        <strong class="amount">{{ money(item.totalCents) }}</strong>
      </li>
    </ul>
  </section>

  <div v-else-if="!hasSubscriptions" class="nudge">
    <p>{{ t('insights.subsEmpty') }}</p>
    <NuxtLink class="vv-link" to="/categories">{{ t('insights.subsEmptyLink') }}</NuxtLink>
  </div>
</template>

<style scoped>
.card { padding: 14px 18px 8px; }
h2 { margin: 0 0 4px; font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--vv-muted); }
ul { list-style: none; margin: 0; padding: 0; }
li { display: flex; align-items: baseline; gap: 10px; padding: 7px 0; font-size: 14px; }
li + li { border-top: 1px solid var(--vv-chart-grid); }
.name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.amount { font-variant-numeric: tabular-nums; white-space: nowrap; }

.nudge { padding: 0 6px; text-align: center; }
.nudge p { margin: 0 0 2px; font-size: 13px; color: var(--vv-muted); }
.nudge .vv-link { display: inline-block; padding: 12px 6px; font-size: 13px; }
</style>
