<script setup lang="ts">
import { MailCheck } from 'lucide-vue-next'

definePageMeta({ layout: false })

const { t } = useI18n()
const email = ref('')
const busy = ref(false)
const sent = ref(false)

async function submit() {
  if (!email.value.trim() || busy.value) return
  busy.value = true
  try {
    await $fetch('/api/auth/forgot-password', { method: 'POST', body: { email: email.value } })
  } catch {
    // Swallowed on purpose - see below.
  } finally {
    busy.value = false
    // Always the same confirmation, even on failure. The endpoint answers
    // identically for known and unknown addresses, and the screen must not
    // undo that by behaving differently.
    sent.value = true
  }
}
</script>

<template>
  <AuthCard :title="sent ? t('auth.sentTitle') : t('auth.forgotTitle')" :sub="sent ? undefined : t('auth.forgotSub')">
    <form v-if="!sent" class="form" @submit.prevent="submit">
      <UiField v-model="email" :label="t('auth.email')" type="email" inputmode="email" autocomplete="email" required />
      <UiButton type="submit" :loading="busy" :disabled="!email.trim()">{{ t('auth.send') }}</UiButton>
    </form>

    <div v-else class="sent">
      <UiIconTile :icon="MailCheck" size="lg" />
      <p>{{ t('auth.sentBody', { email }) }}</p>
    </div>

    <p class="foot"><NuxtLink class="vv-link" to="/login">{{ t('auth.backToLogin') }}</NuxtLink></p>
  </AuthCard>
</template>

<style scoped>
.form { display: grid; gap: 18px; }
.sent { display: grid; justify-items: center; gap: 16px; margin-top: 12px; text-align: center; }
.sent p { margin: 0; font-size: 15px; line-height: 1.5; color: var(--vv-muted); overflow-wrap: anywhere; }
.foot { margin: 22px 0 0; text-align: center; font-size: 14px; }
</style>
