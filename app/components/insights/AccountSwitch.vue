<script setup lang="ts">
/**
 * "All accounts | <name> | <name>" chips. With fewer than two accounts there is
 * nothing to choose, so it renders NOTHING (no element at all).
 */
interface Props { accounts: { id: string; name: string }[] }
defineProps<Props>()
/** null = all accounts. */
const selected = defineModel<string | null>({ default: null })
const { t } = useI18n()
</script>

<template>
  <!-- Scrolls sideways when the names don't fit, like the filter chips. -->
  <div v-if="accounts.length >= 2" class="accounts" role="group" :aria-label="t('insights.accountLabel')">
    <UiChip :active="selected === null" @click="selected = null">{{ t('insights.allAccounts') }}</UiChip>
    <UiChip v-for="a in accounts" :key="a.id" :active="selected === a.id" @click="selected = a.id">{{ a.name }}</UiChip>
  </div>
</template>

<style scoped>
/* Padding keeps the chips' shadows inside the scroller (which clips). */
.accounts {
  display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none;
  margin: 0 -24px; padding: 8px 24px 12px;
}
.accounts::-webkit-scrollbar { display: none; }
@media (max-width: 560px) { .accounts { margin: 0 -18px; padding: 8px 18px 12px; } }
</style>
