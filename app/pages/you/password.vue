<script setup lang="ts">
import { isPasswordValid } from '~~/shared/utils/password'

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

      <PasswordStrength :password="next" />

      <UiButton type="submit" :loading="busy" :disabled="!ready">{{ t('you.pwSave') }}</UiButton>
    </form>
  </div>
</template>

<style scoped>
.card { display: grid; gap: 18px; padding: 20px; }
</style>
