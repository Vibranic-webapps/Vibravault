<script setup lang="ts">
import { Check, Circle } from 'lucide-vue-next'
import { passwordRuleResults, isPasswordValid } from '~~/shared/utils/password'

/**
 * Change your password. The rules come from the same shared module the
 * server enforces, so the checklist can never promise something the server
 * then refuses. Success signs out every OTHER device.
 */
const { t } = useI18n()
const { toast } = useToast()

const current = ref('')
const next = ref('')
const error = ref('')
const busy = ref(false)

const rules = computed(() => passwordRuleResults(next.value))
const ready = computed(() => !!current.value && isPasswordValid(next.value))

async function save() {
  if (!ready.value || busy.value) return
  error.value = ''
  busy.value = true
  try {
    await $fetch('/api/auth/password', { method: 'POST', body: { current: current.value, next: next.value } })
    toast(t('you.pwDone'))
    await navigateTo('/you')
  } catch (e: unknown) {
    const status = (e as { statusCode?: number }).statusCode
    error.value = status === 403 ? t('you.pwWrong') : t('drawer.couldNotSave')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <SubPageHeader :title="t('you.pwTitle')" back="/you" />

    <form class="neu-3 card" @submit.prevent="save">
      <UiField v-model="current" :label="t('you.pwCurrent')" type="password" autocomplete="current-password" :error="error" />
      <UiField v-model="next" :label="t('you.pwNew')" type="password" autocomplete="new-password" />

      <div>
        <p class="needs">{{ t('you.pwNeeds') }}</p>
        <ul class="rules">
          <li v-for="r in rules" :key="r.id" :class="{ ok: r.passed }">
            <component :is="r.passed ? Check : Circle" :size="16" aria-hidden="true" />
            {{ t(`passwordRule.${r.id}`) }}
            <span class="sr">{{ r.passed ? '✓' : '' }}</span>
          </li>
        </ul>
      </div>

      <UiButton type="submit" :loading="busy" :disabled="!ready">{{ t('you.pwSave') }}</UiButton>
    </form>
  </div>
</template>

<style scoped>
.card { display: grid; gap: 18px; padding: 20px; }
.needs { margin: 0 0 8px; font-size: 13px; font-weight: 700; color: var(--vv-muted); }
.rules { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; font-size: 14px; color: var(--vv-muted); }
.rules li { display: flex; align-items: center; gap: 8px; }
.rules li.ok { color: var(--vv-accent); font-weight: 600; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
