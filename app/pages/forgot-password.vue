<script setup lang="ts">
definePageMeta({ layout: false })

const email = ref('')
const pending = ref(false)
const sent = ref(false)

async function submit() {
  pending.value = true
  try {
    await $fetch('/api/auth/forgot-password', { method: 'POST', body: { email: email.value } })
  } finally {
    pending.value = false
    // Always show the same confirmation, even on failure. The endpoint answers
    // identically for known and unknown addresses, and the UI must not undo
    // that by behaving differently.
    sent.value = true
  }
}
</script>

<template>
  <main class="page">
    <div class="neu-3 card">
      <p class="brand">Vibravault</p>

      <template v-if="!sent">
        <h1>Forgot password</h1>
        <p class="sub">We'll email you a link to choose a new one.</p>

        <form @submit.prevent="submit">
          <label class="vv-label" for="email">Email</label>
          <input id="email" v-model="email" class="vv-field" type="email" autocomplete="email" required />

          <button class="vv-btn spaced-lg" type="submit" :disabled="pending || !email.trim()">
            {{ pending ? 'Sending…' : 'Send reset link' }}
          </button>
        </form>
      </template>

      <template v-else>
        <h1>Check your email</h1>
        <p class="sub">
          If an account exists for <strong>{{ email }}</strong>, a reset link is on its way.
          It works once and expires in an hour.
        </p>
      </template>

      <p class="foot"><NuxtLink class="vv-link" to="/login">Back to sign in</NuxtLink></p>
    </div>
  </main>
</template>

<style scoped>
.page { min-height: 100vh; display: grid; place-items: center; padding: 40px 24px 24px; }
.card { position: relative; width: 100%; max-width: 420px; padding: 46px 34px 34px; }
.brand {
  position: absolute; top: -17px; left: 50%;
  transform: translateX(-50%) rotate(-3deg);
  margin: 0; padding: 9px 22px;
  font-size: 12px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase;
  white-space: nowrap; color: #fff; background: var(--vv-brand);
  border-radius: var(--vv-r-badge); box-shadow: var(--vv-e2);
}
h1 { margin: 0 0 4px; font-size: 26px; text-align: center; }
.sub { margin: 0 0 26px; color: var(--vv-muted); font-size: 15px; text-align: center; }
.spaced-lg { margin-top: 26px; }
.foot { margin: 20px 0 0; text-align: center; font-size: 14px; color: var(--vv-muted); }
</style>
