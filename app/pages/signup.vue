<script setup lang="ts">
const user = useAuthUser()

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref<string | null>(null)
const pending = ref(false)

// Live mismatch hint — only once they've actually started typing the second
// field, so it doesn't shout at them mid-keystroke.
const mismatch = computed(
  () => confirmPassword.value.length > 0 && password.value !== confirmPassword.value,
)

async function submit() {
  error.value = null

  // Confirm-password is a TYPO GUARD, so it's checked here and never sent to
  // the server: the API has no use for it, and the real password rules
  // (length, uniqueness of email) are still enforced server-side where they
  // can't be bypassed.
  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match'
    return
  }

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
      <!-- Brand tag: hangs off the top edge of the card, slightly rotated. -->
      <p class="brand">Vibravault</p>

      <h1>Create your vault</h1>
      <p class="sub">Start tracking your money</p>

      <p v-if="error" class="vv-error">{{ error }}</p>

      <label class="vv-label" for="email">Email</label>
      <input id="email" v-model="email" class="vv-field" type="email" autocomplete="email" required />

      <label class="vv-label spaced" for="password">
        Password <span class="hint">at least 8 characters</span>
      </label>
      <input id="password" v-model="password" class="vv-field" type="password" autocomplete="new-password" minlength="8" required />

      <label class="vv-label spaced" for="confirmPassword">Confirm password</label>
      <input
        id="confirmPassword"
        v-model="confirmPassword"
        class="vv-field"
        :class="{ 'vv-field--error': mismatch }"
        type="password"
        autocomplete="new-password"
        required
      />
      <p v-if="mismatch" class="mismatch">Passwords do not match</p>

      <button class="vv-btn spaced-lg" type="submit" :disabled="pending || mismatch">
        {{ pending ? 'Creating account…' : 'Create account' }}
      </button>

      <p class="foot">
        Already have an account? <NuxtLink class="vv-link" to="/login">Sign in</NuxtLink>
      </p>
    </form>
  </main>
</template>

<style scoped>
.page { min-height: 100vh; display: grid; place-items: center; padding: 40px 24px 24px; }

.card { position: relative; width: 100%; max-width: 420px; padding: 46px 34px 34px; }

.brand {
  position: absolute;
  top: -17px;
  left: 50%;
  transform: translateX(-50%) rotate(-3deg);
  margin: 0;
  padding: 9px 22px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .14em;
  text-transform: uppercase;
  white-space: nowrap;
  color: #fff;
  background: var(--vv-indigo);
  border-radius: 14px;
  box-shadow: var(--vv-clay-sm);
}

h1 { margin: 0 0 4px; font-size: 26px; text-align: center; }
.sub { margin: 0 0 26px; color: var(--vv-muted); font-size: 15px; text-align: center; }
.hint { font-weight: 500; color: var(--vv-muted-2); }
.mismatch { margin: 8px 0 0; font-size: 13px; font-weight: 600; color: var(--vv-coral); }
.spaced { margin-top: 18px; }
.spaced-lg { margin-top: 26px; }
.foot { margin: 20px 0 0; text-align: center; font-size: 14px; color: var(--vv-muted); }
</style>
