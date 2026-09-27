<script setup lang="ts">
import { isPasswordValid } from '~~/shared/utils/password'

definePageMeta({ layout: false })

const { t } = useI18n()
const user = useAuthUser()

const name = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const emailError = ref('')
const busy = ref(false)

const strong = computed(() => isPasswordValid(password.value))

async function submit() {
  if (!strong.value || busy.value) return
  error.value = ''
  emailError.value = ''
  busy.value = true
  try {
    user.value = await $fetch('/api/auth/signup', {
      method: 'POST',
      body: { name: name.value, email: email.value, password: password.value },
    })
    await navigateTo('/')
  } catch (e: unknown) {
    const status = (e as { statusCode?: number; statusMessage?: string }).statusCode
    const message = (e as { statusMessage?: string }).statusMessage ?? ''
    if (status === 409) emailError.value = t('auth.emailTaken')
    else if (status === 400 && /email/i.test(message)) emailError.value = t('auth.badEmail')
    else error.value = t('auth.generic')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AuthCard :title="t('auth.signupTitle')" :sub="t('auth.signupSub')">
    <form class="form" @submit.prevent="submit">
      <UiField
        v-model="name"
        :label="`${t('auth.name')} · ${t('common.optional')}`"
        :placeholder="t('you.namePh')"
        autocomplete="given-name"
        :maxlength="40"
      />
      <UiField v-model="email" :label="t('auth.email')" type="email" inputmode="email" autocomplete="email" required :error="emailError" />
      <UiField v-model="password" :label="t('auth.password')" type="password" autocomplete="new-password" required />
      <PasswordStrength :password="password" />

      <p v-if="error" class="vv-error" role="alert">{{ error }}</p>
      <UiButton type="submit" :loading="busy" :disabled="!strong">{{ t('auth.createAccount') }}</UiButton>
    </form>

    <p class="foot">{{ t('auth.haveAccount') }} <NuxtLink class="vv-link" to="/login">{{ t('auth.signInLink') }}</NuxtLink></p>
  </AuthCard>
</template>

<style scoped>
.form { display: grid; gap: 18px; }
.foot { margin: 22px 0 0; text-align: center; font-size: 14px; color: var(--vv-muted); }
</style>
