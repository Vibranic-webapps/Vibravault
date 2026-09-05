<script setup lang="ts">
import { passwordRuleResults, passwordScore, isPasswordValid, STRENGTH_LABELS } from '~~/shared/utils/password'

definePageMeta({ layout: false })

const route = useRoute()
const user = useAuthUser()

const token = computed(() => String(route.query.token ?? ''))
const password = ref('')
const error = ref<string | null>(null)
const pending = ref(false)

const rules = computed(() => passwordRuleResults(password.value))
const score = computed(() => passwordScore(password.value))
const strong = computed(() => isPasswordValid(password.value))
const barColor = computed(() =>
  score.value >= 4 ? 'var(--vv-accent)' : score.value === 3 ? 'var(--vv-brand)' : 'var(--vv-negative)',
)

async function submit() {
  error.value = null
  pending.value = true
  try {
    await $fetch('/api/auth/reset-password', {
      method: 'POST',
      body: { token: token.value, password: password.value },
    })
    // The endpoint logs us straight in; refresh who we are, then go home.
    user.value = await $fetch('/api/auth/me')
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
    <div class="neu-3 card">
      <p class="brand">Vibravault</p>

      <template v-if="!token">
        <h1>Link is missing</h1>
        <p class="sub">This page needs a reset link from your email.</p>
      </template>

      <template v-else>
        <h1>Choose a new password</h1>
        <p class="sub">This also signs you out everywhere else.</p>

        <p v-if="error" class="vv-error">{{ error }}</p>

        <form @submit.prevent="submit">
          <label class="vv-label" for="password">New password</label>
          <input id="password" v-model="password" class="vv-field" type="password" autocomplete="new-password" required />

          <div class="meter" :aria-label="`Password strength: ${STRENGTH_LABELS[score]}`">
            <div class="meter-track">
              <div class="meter-fill" :style="{ width: `${(score / 4) * 100}%`, background: barColor }" />
            </div>
            <span v-if="password" class="meter-label" :style="{ color: barColor }">
              {{ STRENGTH_LABELS[score] }}
            </span>
          </div>

          <ul class="rules">
            <li v-for="rule in rules" :key="rule.id" :class="{ met: rule.passed }">
              <span class="tick" aria-hidden="true">{{ rule.passed ? '✓' : '○' }}</span>
              {{ rule.label }}
            </li>
          </ul>

          <button class="vv-btn spaced-lg" type="submit" :disabled="pending || !strong">
            {{ pending ? 'Saving…' : 'Save new password' }}
          </button>
        </form>
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
.spaced-lg { margin-top: 24px; }
.foot { margin: 20px 0 0; text-align: center; font-size: 14px; color: var(--vv-muted); }

.meter { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
.meter-track {
  flex: 1; height: 8px; border-radius: var(--vv-r-badge);
  background: var(--vv-surface); box-shadow: var(--vv-p1); overflow: hidden;
}
.meter-fill { height: 100%; border-radius: var(--vv-r-badge); transition: width .25s ease, background .25s ease; }
.meter-label { min-width: 44px; font-size: 12px; font-weight: 700; text-align: right; }

.rules { list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 6px; }
.rules li { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--vv-muted-2); transition: color .2s ease; }
.rules li.met { color: var(--vv-accent); font-weight: 600; }
.tick { width: 14px; text-align: center; font-size: 12px; }
</style>
