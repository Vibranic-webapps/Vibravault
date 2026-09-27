<script setup lang="ts">
import { Check, Circle } from 'lucide-vue-next'
import { passwordRuleResults, passwordScore } from '~~/shared/utils/password'

/**
 * Strength bar + rule checklist under a new-password field (create account,
 * reset, change password). The rules come from the same shared module the
 * server enforces, so the checklist can never promise something the server
 * then refuses.
 */
const props = defineProps<{ password: string }>()
const { t } = useI18n()

const rules = computed(() => passwordRuleResults(props.password))
const score = computed(() => passwordScore(props.password))

// 1-2 rules = coral (weak), 3 = indigo, 4 = teal (strong). Inside the
// palette instead of inventing a red/amber/green ramp.
const barColor = computed(() =>
  score.value >= 4 ? 'var(--vv-accent)' : score.value === 3 ? 'var(--vv-brand)' : 'var(--vv-negative)',
)
const level = computed(() => (score.value ? t(`strength.${score.value}`) : ''))
</script>

<template>
  <div class="strength">
    <div class="meter" role="meter" :aria-valuenow="score" aria-valuemin="0" aria-valuemax="4" :aria-label="t('strength.label', { level })">
      <div class="track"><div class="fill" :style="{ width: `${(score / 4) * 100}%`, background: barColor }" /></div>
      <span v-if="password" class="level" :style="{ color: barColor }">{{ level }}</span>
    </div>
    <ul class="rules">
      <li v-for="r in rules" :key="r.id" :class="{ ok: r.passed }">
        <component :is="r.passed ? Check : Circle" :size="15" aria-hidden="true" />
        {{ t(`passwordRule.${r.id}`) }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.strength { display: grid; gap: 10px; }
.meter { display: flex; align-items: center; gap: 10px; }
.track { flex: 1; height: 8px; border-radius: 999px; box-shadow: var(--vv-p1); overflow: hidden; }
.fill { height: 100%; border-radius: 999px; transition: width .2s ease, background .2s ease; }
.level { min-width: 52px; font-size: 12px; font-weight: 700; text-align: right; }
.rules { list-style: none; margin: 0; padding: 0; display: grid; gap: 5px; font-size: 13px; color: var(--vv-muted); }
.rules li { display: flex; align-items: center; gap: 8px; }
.rules li.ok { color: var(--vv-accent); font-weight: 600; }
@media (prefers-reduced-motion: reduce) { .fill { transition: none; } }
</style>
