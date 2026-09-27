<script setup lang="ts">
import { Sparkles, Smartphone, LogOut } from 'lucide-vue-next'
import { useRulesStore } from '~/stores/rules'

/**
 * "You" - Wave 2 version: everything that left the header (appearance,
 * sign-out, the way to settings) plus language. Wave 3 merges the rest of
 * /settings in here and rewrites it for a first-time user.
 */
const { t, locale, setLocale } = useI18n()
const user = useAuthUser()
const theme = useTheme()
const rules = useRulesStore()
await rules.fetchAll()

const lang = computed({
  get: () => locale.value,
  set: (v: string) => setLocale(v as 'en' | 'nl'),
})

const initial = computed(() => ((user.value?.name || user.value?.email)?.[0] ?? '?').toUpperCase())

// --- Your name ------------------------------------------------------------
// Saved when you leave the field (or press Enter) - no Save button to forget.
const { toast } = useToast()
const MAX_NAME = 40
const name = ref(user.value?.name ?? '')
const nameError = ref('')
let savingName = false // Enter then tapping away must not save twice

async function saveName() {
  const clean = name.value.replace(/\s+/g, ' ').trim()
  if (savingName || clean === (user.value?.name ?? '')) return // nothing changed
  if (clean.length > MAX_NAME) { nameError.value = t('you.nameTooLong'); return }
  nameError.value = ''
  savingName = true
  try {
    const updated = await $fetch('/api/auth/me', { method: 'PATCH', body: { name: clean } })
    user.value = updated
    name.value = updated.name ?? ''
    toast(t('you.nameSaved'))
  } catch {
    toast(t('common.retry'), 'bad')
  } finally {
    savingName = false
  }
}

async function signOut() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  user.value = null
  await navigateTo('/login')
}
</script>

<template>
  <div>
    <h1>{{ t('you.title') }}</h1>

    <section class="neu-3 card">
      <div class="who">
        <span class="avatar neu" aria-hidden="true">{{ initial }}</span>
        <span class="email">{{ user?.email }}</span>
      </div>
      <UiField
        v-model="name"
        class="name"
        :label="t('you.name')"
        :placeholder="t('you.namePh')"
        :hint="t('you.nameHint')"
        :error="nameError"
        autocomplete="given-name"
        :maxlength="MAX_NAME"
        @enter="saveName"
        @focusout="saveName"
      />
    </section>

    <h2>{{ t('you.settings') }}</h2>
    <section class="neu-3 card stack">
      <UiSegmented
        v-model="lang"
        :label="t('language.label')"
        :options="[{ value: 'en', label: 'English' }, { value: 'nl', label: 'Nederlands' }]"
      />
      <UiSegmented
        v-model="theme"
        :label="t('theme.label')"
        :options="[
          { value: 'system', label: t('theme.system') },
          { value: 'light', label: t('theme.light') },
          { value: 'dark', label: t('theme.dark') },
        ]"
      />
    </section>

    <h2>{{ t('you.tools') }}</h2>
    <section class="neu-3 card rows">
      <UiListRow :icon="Sparkles" :label="t('you.rules')" :value="String(rules.items.length)" to="/settings#rules" />
      <UiListRow :icon="Smartphone" :label="t('you.phone')" to="/settings#phone" />
    </section>

    <h2>{{ t('you.account') }}</h2>
    <section class="neu-3 card rows">
      <UiListRow :icon="LogOut" :label="t('you.signOut')" danger @click="signOut" />
    </section>
  </div>
</template>

<style scoped>
h1 { margin: 0 0 18px; font-size: 28px; font-weight: 800; }
h2 { margin: 26px 0 10px; font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--vv-muted); }
.card { padding: 20px; }
.rows { padding: 6px 18px; }
.stack { display: grid; gap: 16px; }

.who { display: flex; align-items: center; gap: 14px; }
.avatar {
  display: grid; place-items: center; width: 48px; height: 48px; flex: none;
  font-size: 20px; font-weight: 800; color: var(--vv-accent);
  border-radius: var(--vv-r-sm);
}
.name { margin-top: 18px; }
.email { min-width: 0; font-size: 15px; font-weight: 600; overflow-wrap: anywhere; }
</style>
