<script setup lang="ts">
const user = useAuthUser()

const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const pending = ref(false)

async function submit() {
  error.value = null
  pending.value = true
  try {
    user.value = await $fetch('/api/auth/signup', {
      method: 'POST',
      body: { email: email.value, password: password.value },
    })
    await navigateTo('/')
  } catch (e: any) {
    error.value = e?.statusMessage ?? 'Something went wrong'
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <main class="page">
    <form class="clay card" @submit.prevent="submit">
      <p class="eyebrow">Vibravault</p>
      <h1>Create your vault</h1>
      <p class="sub">Start tracking your money</p>

      <p v-if="error" class="vv-error">{{ error }}</p>

      <label class="vv-label" for="email">Email</label>
      <input id="email" v-model="email" class="vv-field" type="email" autocomplete="email" required />

      <label class="vv-label spaced" for="password">Password <span class="hint">at least 8 characters</span></label>
      <input id="password" v-model="password" class="vv-field" type="password" autocomplete="new-password" minlength="8" required />

      <button class="vv-btn spaced-lg" type="submit" :disabled="pending">
        {{ pending ? 'Creating account…' : 'Create account' }}
      </button>

      <p class="foot">
        Already have an account? <NuxtLink class="vv-link" to="/login">Sign in</NuxtLink>
      </p>
    </form>
  </main>
</template>

<style scoped>
.page { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
.card { width: 100%; max-width: 420px; padding: 34px; }
.eyebrow {
  margin: 0 0 6px; font-size: 12px; font-weight: 700; letter-spacing: .14em;
  text-transform: uppercase; color: var(--vv-indigo);
}
h1 { margin: 0 0 4px; font-size: 26px; }
.sub { margin: 0 0 26px; color: var(--vv-muted); font-size: 15px; }
.spaced { margin-top: 18px; }
.spaced-lg { margin-top: 26px; }
.hint { font-weight: 500; color: var(--vv-muted-2); }
.foot { margin: 20px 0 0; text-align: center; font-size: 14px; color: var(--vv-muted); }
</style>
