<script setup lang="ts">
definePageMeta({ layout: false })

const { t } = useI18n()
const user = useAuthUser()

const email = ref('')
const password = ref('')
const remember = ref(true)
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  busy.value = true
  try {
    user.value = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: email.value, password: password.value, remember: remember.value },
    })
    await navigateTo('/')
  } catch (e: unknown) {
    // One message for "unknown email" and "wrong password" - the server
    // deliberately doesn't say which, and neither does the screen.
    error.value = (e as { statusCode?: number }).statusCode === 401 ? t('auth.wrongLogin') : t('auth.generic')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AuthCard :title="t('auth.loginTitle')" :sub="t('auth.loginSub')">
    <form class="form" @submit.prevent="submit">
      <UiField v-model="email" :label="t('auth.email')" type="email" inputmode="email" autocomplete="email" required />
      <UiField v-model="password" :label="t('auth.password')" type="password" autocomplete="current-password" required :error="error" />

      <div class="between">
        <UiCheckbox v-model="remember">{{ t('auth.remember') }}</UiCheckbox>
        <NuxtLink class="vv-link small" to="/forgot-password">{{ t('auth.forgot') }}</NuxtLink>
      </div>

      <UiButton type="submit" :loading="busy">{{ t('auth.signIn') }}</UiButton>
    </form>

    <p class="foot">{{ t('auth.noAccount') }} <NuxtLink class="vv-link" to="/signup">{{ t('auth.createOne') }}</NuxtLink></p>
  </AuthCard>
</template>

<style scoped>
.form { display: grid; gap: 18px; }
.between { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.small { font-size: 14px; }
.foot { margin: 22px 0 0; text-align: center; font-size: 14px; color: var(--vv-muted); }
</style>
