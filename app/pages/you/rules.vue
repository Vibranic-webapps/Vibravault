<script setup lang="ts">
import { Trash2, Sparkles } from 'lucide-vue-next'
import { useRulesStore, type MerchantRule } from '~/stores/rules'
import { useCategoriesStore } from '~/stores/categories'

/**
 * The rules you've taught: "bank text contains X -> call it Y, file it
 * under Z". Made from a transaction (⋯ -> Rename & sort all like this);
 * here you can see and delete them.
 */
const { t } = useI18n()
const { money } = useFormat()
const { toast } = useToast()
const rules = useRulesStore()
const categories = useCategoriesStore()
await Promise.all([rules.fetchAll(), categories.fetchAll()])

async function remove(r: MerchantRule) {
  if (!confirm(t('you.ruleDeleteConfirm', { match: r.match }))) return
  await rules.remove(r.id)
  if (!rules.error) toast(t('you.ruleDeleted'))
}

/** "€ 0,99", or "€ 1,00 – € 5,00" for a range; null when the rule has no amount condition. */
function amountText(r: MerchantRule): string | null {
  const { amountMinCents: min, amountMaxCents: max } = r
  if (min == null && max == null) return null
  if (min != null && max != null) return min === max ? money(min) : `${money(min)} – ${money(max)}`
  return min != null ? t('you.ruleAmountFrom', { amount: money(min) }) : t('you.ruleAmountUpTo', { amount: money(max!) })
}

function tint(id: string | null) {
  const c = id ? categories.byId.get(id) : undefined
  return c ? { background: `var(--vv-${c.color})`, color: `var(--vv-${c.color}-fg)` } : {}
}
</script>

<template>
  <div>
    <SubPageHeader :title="t('you.rulesTitle')" back="/you" />
    <p class="intro">{{ t('you.rulesIntro') }}</p>

    <section v-if="!rules.items.length" class="neu-3 empty">
      <UiIconTile :icon="Sparkles" size="lg" />
      <p>{{ t('you.rulesEmpty') }}</p>
    </section>

    <ul v-else class="neu-3 list">
      <li v-for="r in rules.items" :key="r.id" class="rule">
        <span class="r-tile neu" :style="tint(r.categoryId)" aria-hidden="true">
          <CategoryIcon v-if="r.categoryId" :name="categories.byId.get(r.categoryId)?.icon" :size="17" />
        </span>
        <span class="r-main">
          <strong>{{ r.label ?? t('you.ruleKeepsName') }}</strong>
          <span v-if="amountText(r)" class="r-amount">{{ amountText(r) }}</span>
          <small>{{ t('you.ruleWhen', { match: r.match }) }}</small>
          <small v-if="r.categoryId && categories.byId.get(r.categoryId)" class="r-cat">
            → {{ categories.byId.get(r.categoryId)!.name }}
          </small>
        </span>
        <UiIconButton :icon="Trash2" :label="`${t('you.ruleDelete')}: ${r.match}`" size="sm" @click="remove(r)" />
      </li>
    </ul>

    <p v-if="rules.error" class="vv-error" role="alert">{{ rules.error }}</p>
  </div>
</template>

<style scoped>
.intro { margin: 0 0 20px; font-size: 15px; line-height: 1.5; color: var(--vv-muted); }
.empty { display: grid; justify-items: center; gap: 14px; padding: 30px 22px; text-align: center; }
.empty p { margin: 0; color: var(--vv-muted); }
.list { list-style: none; margin: 0; padding: 4px 16px; }
.rule { display: flex; align-items: center; gap: 13px; padding: 12px 0; }
.rule + .rule { border-top: 1px solid var(--vv-shadow-dark); }
.r-tile { display: grid; place-items: center; width: 40px; height: 40px; flex: none; font-size: 17px; border-radius: var(--vv-r-sm); }
.r-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.r-main strong { font-size: 15px; font-weight: 700; overflow-wrap: anywhere; }
.r-main small { font-size: 13px; color: var(--vv-muted); overflow-wrap: anywhere; }
.r-cat { font-weight: 600; }
/* A small pressed badge: this rule only fires on this amount. */
.r-amount { align-self: flex-start; padding: 2px 10px; border-radius: var(--vv-r-badge); box-shadow: var(--vv-p1); font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; }
</style>
