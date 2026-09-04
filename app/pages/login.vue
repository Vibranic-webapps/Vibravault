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
    user.value = await $fetch('/api/auth/login', {
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
      <h1>Welcome back</h1>
      <p class="sub">Sign in to your vault</p>

      <p v-if="error" class="vv-error">{{ error }}</p>

      <label class="vv-label" for="email">Email</label>
      <input id="email" v-model="email" class="vv-field" type="email" autocomplete="email" required />

      <label class="vv-label spaced" for="password">Password</label>
      <input id="password" v-model="password" class="vv-field" type="password" autocomplete="current-password" required />

      <button class="vv-btn spaced-lg" type="submit" :disabled="pending">
        {{ pending ? 'Signing in…' : 'Sign in' }}
      </button>

      <p class="foot">
        No account yet? <NuxtLink class="vv-link" to="/signup">Create one</NuxtLink>
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
.foot { margin: 20px 0 0; text-align: center; font-size: 14px; color: var(--vv-muted); }
</style>
