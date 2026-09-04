<script setup lang="ts">
import {
  passwordRuleResults,
  passwordScore,
  isPasswordValid,
  STRENGTH_LABELS,
} from '~~/shared/utils/password'

const user = useAuthUser()

const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const pending = ref(false)

const rules = computed(() => passwordRuleResults(password.value))
const score = computed(() => passwordScore(password.value))
const strong = computed(() => isPasswordValid(password.value))

// 1-2 rules = coral (weak), 3 = indigo (fair-good), 4 = teal (strong).
// Stays inside the palette instead of inventing a red/amber/green ramp.
const barColor = computed(() =>
  score.value >= 4 ? 'var(--vv-teal)' : score.value === 3 ? 'var(--vv-indigo)' : 'var(--vv-coral)',
)

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
    <form class="neu card" @submit.prevent="submit">
      <p class="brand">Vibravault</p>

      <h1>Create your vault</h1>
      <p class="sub">Start tracking your money</p>

      <p v-if="error" class="vv-error">{{ error }}</p>

      <label class="vv-label" for="email">Email</label>
      <input id="email" v-model="email" class="vv-field" type="email" autocomplete="email" required />

      <label class="vv-label spaced" for="password">Password</label>
      <input
        id="password"
        v-model="password"
        class="vv-field"
        type="password"
        autocomplete="new-password"
        required
      />

      <!-- Strength bar, directly under the field it describes. -->
      <div class="meter" :aria-label="`Password strength: ${STRENGTH_LABELS[score]}`">
        <div class="meter-track">
          <div
            class="meter-fill"
            :style="{ width: `${(score / 4) * 100}%`, background: barColor }"
          />
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
  box-shadow: var(--vv-neu-sm);
}

h1 { margin: 0 0 4px; font-size: 26px; text-align: center; }
.sub { margin: 0 0 26px; color: var(--vv-muted); font-size: 15px; text-align: center; }
.spaced { margin-top: 18px; }
.spaced-lg { margin-top: 24px; }

.meter { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
.meter-track {
  flex: 1;
  height: 8px;
  border-radius: 999px;
  background: var(--vv-cream);
  box-shadow: var(--vv-neu-inset); /* the track is pressed in, like the inputs */
  overflow: hidden;
}
.meter-fill { height: 100%; border-radius: 999px; transition: width .25s ease, background .25s ease; }
.meter-label { min-width: 44px; font-size: 12px; font-weight: 700; text-align: right; }

.rules { list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 6px; }
.rules li {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; color: var(--vv-muted-2);
  transition: color .2s ease;
}
.rules li.met { color: var(--vv-teal); font-weight: 600; }
.tick { width: 14px; text-align: center; font-size: 12px; }

.foot { margin: 20px 0 0; text-align: center; font-size: 14px; color: var(--vv-muted); }
</style>
