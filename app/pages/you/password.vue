<script setup lang="ts">
import { Lock } from 'lucide-vue-next'
import { isPasswordValid } from '~~/shared/utils/password'
import { DEMO_REFUSAL } from '~~/shared/utils/demo'

/**
 * Change your password. The rules come from the same shared module the
 * server enforces, so the checklist can never promise something the server
 * then refuses. Success signs out every OTHER device.
 *
 * The shared DEMO account can't change its password (the server refuses), so
 * it gets the locked message instead of a form, also when /you/password is
 * opened directly.
 */
const { t } = useI18n()
const { toast } = useToast()
const user = useAuthUser()

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
    const statusCode = (e as { statusCode?: number }).statusCode
    if (statusCode === 403 && serverMessage(e) === DEMO_REFUSAL) error.value = t('you.demoLocked')
    else error.value = statusCode === 403 ? t('you.pwWrong') : t('drawer.couldNotSave')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <SubPageHeader :title="t('you.pwTitle')" back="/you" />

    <section v-if="user?.demo" class="neu-3 card locked">
      <UiIconTile :icon="Lock" size="lg" />
      <p>{{ t('you.demoPwLocked') }}</p>
      <NuxtLink class="vv-link" to="/you">{{ t('you.backToYou') }}</NuxtLink>
    </section>

    <form v-else class="neu-3 card" @submit.prevent="save">
      <UiField v-model="current" :label="t('you.pwCurrent')" type="password" autocomplete="current-password" :error="error" />
      <UiField v-model="next" :label="t('you.pwNew')" type="password" autocomplete="new-password" />

      <PasswordStrength :password="next" />

      <UiButton type="submit" :loading="busy" :disabled="!ready">{{ t('you.pwSave') }}</UiButton>
    </form>
  </div>
</template>

<style scoped>
.card { display: grid; gap: 18px; padding: 20px; }
.locked { justify-items: center; text-align: center; }
.locked p { margin: 0; font-size: 15px; line-height: 1.5; color: var(--vv-muted); }
.locked .vv-link { font-size: 14px; }
</style>
