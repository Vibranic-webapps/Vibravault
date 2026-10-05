<script setup lang="ts">
import { Sparkles, Smartphone, Download, KeyRound, LogOut, Lock } from 'lucide-vue-next'
import { useRulesStore } from '~/stores/rules'

/**
 * "You" - settings and profile in ONE place (#1, #2), as grouped rows:
 *   who you are      name (greets you on Home), email
 *   preferences      language, appearance
 *   your vault       rules, share from your phone, export
 *   account          change password, sign out
 * Rows with a chevron go one level down (/you/rules, /you/phone, ...).
 *
 * The shared DEMO account (its login is public) gets a notice instead of the
 * things the server refuses for it: the name is shown read-only and the
 * "Change password" row is hidden. Everything else works as for anyone.
 */
interface ImportToken { id: string; revokedAt: string | null }

const { t, locale, setLocale } = useI18n()
const user = useAuthUser()
const theme = useTheme()
const { toast } = useToast()
const rules = useRulesStore()

const [, { data: tokens }] = await Promise.all([
  rules.fetchAll(),
  useAsyncData<ImportToken[]>('import-tokens', () => useRequestFetch()('/api/import-tokens')),
])
const phoneOn = computed(() => (tokens.value ?? []).some((tk) => !tk.revokedAt))

const lang = computed({
  get: () => locale.value,
  set: (v: string) => setLocale(v as 'en' | 'nl'),
})

const isDemo = computed(() => !!user.value?.demo)
const initial = computed(() => ((user.value?.name || user.value?.email)?.[0] ?? '?').toUpperCase())

// --- Your name ------------------------------------------------------------
// Saved when you leave the field (or press Enter) - no Save button to forget.
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
  } catch (e: unknown) {
    // 403 = the demo account (its name is locked server-side). Put the old
    // name back so the field doesn't pretend the change stuck.
    if ((e as { statusCode?: number }).statusCode === 403) {
      name.value = user.value?.name ?? ''
      toast(t('you.demoLocked'), 'bad')
    } else {
      toast(t('drawer.couldNotSave'), 'bad')
    }
  } finally {
    savingName = false
  }
}

// --- Export ---------------------------------------------------------------
// A plain navigation to the file: the browser (or iOS's preview, in the
// installed app) handles the download and the Share button.
function exportAll() {
  window.location.href = `/api/transactions/export?lang=${locale.value}`
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

    <section v-if="isDemo" class="neu-3 card notice">
      <UiIconTile :icon="Lock" size="sm" />
      <p>{{ t('you.demoNotice') }}</p>
    </section>

    <section class="neu-3 card">
      <div class="who">
        <span class="avatar neu" aria-hidden="true">{{ initial }}</span>
        <span class="ident">
          <!-- Demo: the name is locked, so show it as text, not as a field. -->
          <strong v-if="isDemo && user?.name" class="shown-name">{{ user.name }}</strong>
          <span class="email">{{ user?.email }}</span>
        </span>
      </div>
      <UiField
        v-if="!isDemo"
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

    <h2>{{ t('you.vault') }}</h2>
    <section class="neu-3 card rows">
      <UiListRow :icon="Sparkles" :label="t('you.rulesTitle')" :value="t('you.rulesCount', rules.items.length)" to="/you/rules" />
      <UiListRow :icon="Smartphone" :label="t('you.phoneTitle')" :value="phoneOn ? t('you.phoneOn') : undefined" to="/you/phone" />
      <UiListRow :icon="Download" :label="t('you.export')" :hint="t('you.exportHint')" @click="exportAll" />
    </section>

    <h2>{{ t('you.account') }}</h2>
    <section class="neu-3 card rows">
      <UiListRow v-if="!isDemo" :icon="KeyRound" :label="t('you.password')" to="/you/password" />
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
.ident { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.shown-name { font-size: 17px; font-weight: 800; overflow-wrap: anywhere; }
.email { min-width: 0; font-size: 15px; font-weight: 600; overflow-wrap: anywhere; }
.shown-name + .email { font-size: 14px; color: var(--vv-muted); }

.notice { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 18px; padding: 16px 18px; }
.notice p { margin: 0; font-size: 14px; line-height: 1.5; color: var(--vv-muted); }
</style>
