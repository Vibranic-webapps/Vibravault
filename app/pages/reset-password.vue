<script setup lang="ts">
import { LinkIcon } from 'lucide-vue-next'
import { isPasswordValid } from '~~/shared/utils/password'

definePageMeta({ layout: false })

const { t } = useI18n()
const route = useRoute()
const user = useAuthUser()

const token = computed(() => String(route.query.token ?? ''))
const password = ref('')
const error = ref('')
const busy = ref(false)
const strong = computed(() => isPasswordValid(password.value))

async function submit() {
  if (!strong.value || busy.value) return
  error.value = ''
  busy.value = true
  try {
    await $fetch('/api/auth/reset-password', {
      method: 'POST',
      body: { token: token.value, password: password.value },
    })
    // The endpoint signs us straight in; refresh who we are, then go home.
    user.value = await $fetch('/api/auth/me')
    await navigateTo('/')
  } catch (e: unknown) {
    const message = (e as { statusMessage?: string }).statusMessage ?? ''
    error.value = /invalid|expired/i.test(message) ? t('auth.expired') : t('auth.generic')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AuthCard v-if="!token" :title="t('auth.missingTitle')">
    <div class="missing">
      <UiIconTile :icon="LinkIcon" size="lg" />
      <p>{{ t('auth.missingBody') }}</p>
      <UiButton to="/forgot-password">{{ t('auth.requestNew') }}</UiButton>
    </div>
  </AuthCard>

  <AuthCard v-else :title="t('auth.resetTitle')" :sub="t('auth.resetSub')">
    <form class="form" @submit.prevent="submit">
      <UiField v-model="password" :label="t('auth.newPassword')" type="password" autocomplete="new-password" required />
      <PasswordStrength :password="password" />

      <p v-if="error" class="vv-error" role="alert">
        {{ error }}
        <NuxtLink v-if="error === t('auth.expired')" class="vv-link" to="/forgot-password">{{ t('auth.requestNew') }}</NuxtLink>
      </p>
      <UiButton type="submit" :loading="busy" :disabled="!strong">{{ t('auth.savePassword') }}</UiButton>
    </form>

    <p class="foot"><NuxtLink class="vv-link" to="/login">{{ t('auth.backToLogin') }}</NuxtLink></p>
  </AuthCard>
</template>

<style scoped>
.form { display: grid; gap: 18px; }
.missing { display: grid; justify-items: center; gap: 16px; margin-top: 12px; text-align: center; }
.missing p { margin: 0; font-size: 15px; line-height: 1.5; color: var(--vv-muted); }
.missing :deep(.btn) { width: 100%; }
.foot { margin: 22px 0 0; text-align: center; font-size: 14px; }
</style>
