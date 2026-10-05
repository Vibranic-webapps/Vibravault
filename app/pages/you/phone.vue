<script setup lang="ts">
import { KeyRound, Smartphone } from 'lucide-vue-next'

/**
 * Share from your phone - a guided setup, written for someone who has never
 * built a Shortcut:
 *   1. create a key (shown ONCE - only its hash is stored)
 *   2. build the Shortcut, with every value to paste behind a Copy button
 *   3. use it
 * Below: the devices that have a key, each removable on its own.
 */
interface ImportToken {
  id: string
  name: string
  lastUsedAt: string | null
  revokedAt: string | null
  createdAt: string
}

const { t } = useI18n()
const user = useAuthUser()
const { date } = useFormat()
const { toast } = useToast()

const { data: tokens, refresh } = await useAsyncData<ImportToken[]>(
  'import-tokens',
  () => useRequestFetch()('/api/import-tokens'),
)
const active = computed(() => (tokens.value ?? []).filter((tk) => !tk.revokedAt))

const deviceName = ref('iPhone')
const created = ref<string | null>(null) // the raw key - exists only right now
const busy = ref(false)

// Where the Shortcut must send the file. On the server there's no window,
// so fall back to the live address (the page re-renders on the client).
const endpoint = computed(() =>
  // ?format=text: the answer is one readable line, so the Shortcut can show
  // it as a notification directly (no "Get Dictionary Value" step).
  `${import.meta.client ? window.location.origin : 'https://vibravault.kilianfrederix.net'}/api/import/shortcut?format=text`,
)

async function createKey() {
  busy.value = true
  try {
    const res = await $fetch<{ raw: string }>('/api/import-tokens', { method: 'POST', body: { name: deviceName.value } })
    created.value = res.raw
    await refresh()
  } catch {
    toast(t('drawer.couldNotSave'), 'bad')
  } finally {
    busy.value = false
  }
}

async function revoke(tk: ImportToken) {
  if (!confirm(t('you.revokeConfirm', { name: tk.name }))) return
  await $fetch(`/api/import-tokens/${tk.id}`, { method: 'DELETE' })
  await refresh()
  toast(t('you.revoked'))
}
</script>

<template>
  <div>
    <SubPageHeader :title="t('you.phoneTitle')" back="/you" />
    <p class="intro">{{ t('you.phoneIntro') }}</p>

    <!-- 1. Key -->
    <section class="neu-3 card step">
      <h2><span class="num">1</span>{{ t('you.step1') }}</h2>
      <p class="body">{{ t('you.step1Body') }}</p>

      <div v-if="created" class="reveal">
        <p class="warn">{{ t('you.keyCopyNow') }}</p>
        <CopyField :value="created" />
      </div>
      <p v-else-if="user?.demo" class="body locked">{{ t('you.demoKeysLocked') }}</p>
      <div v-else class="create">
        <UiField v-model="deviceName" :label="t('you.deviceName')" :maxlength="40" @enter="createKey" />
        <UiButton :icon="KeyRound" :loading="busy" @click="createKey">{{ t('you.createKey') }}</UiButton>
      </div>
    </section>

    <!-- 2. Shortcut -->
    <section class="neu-3 card step">
      <h2><span class="num">2</span>{{ t('you.step2') }}</h2>
      <p class="body">{{ t('you.step2Body') }}</p>
      <ol class="how">
        <li>{{ t('you.s1') }}</li>
        <li>{{ t('you.s2') }} <CopyField :value="endpoint" /></li>
        <li>{{ t('you.s3') }}</li>
        <li>{{ t('you.s4') }} <CopyField value="x-import-token" /> {{ t('you.s4b') }}</li>
        <li>{{ t('you.s5') }}</li>
        <li>{{ t('you.s6') }}</li>
        <li>{{ t('you.s7') }}</li>
        <li>{{ t('you.s8') }}</li>
      </ol>
    </section>

    <!-- 3. Use -->
    <section class="neu-3 card step">
      <h2><span class="num">3</span>{{ t('you.step3') }}</h2>
      <p class="body">{{ t('you.step3Body') }}</p>
    </section>

    <!-- Devices -->
    <h3 class="group">{{ t('you.devices') }}</h3>
    <section class="neu-3 card rows">
      <p v-if="!active.length" class="none">{{ t('you.devicesEmpty') }}</p>
      <div v-for="tk in active" :key="tk.id" class="device">
        <UiIconTile :icon="Smartphone" size="sm" />
        <span class="d-main">
          <strong>{{ tk.name }}</strong>
          <small>{{ tk.lastUsedAt ? t('you.lastUsed', { date: date(tk.lastUsedAt, { day: 'numeric', month: 'short', year: 'numeric' }) }) : t('you.neverUsed') }}</small>
        </span>
        <UiButton variant="danger" :block="false" @click="revoke(tk)">{{ t('you.revoke') }}</UiButton>
      </div>
    </section>
  </div>
</template>

<style scoped>
.intro { margin: 0 0 20px; font-size: 15px; line-height: 1.5; color: var(--vv-muted); }
.card { padding: 20px; margin-bottom: 16px; }
.step h2 { display: flex; align-items: center; gap: 12px; margin: 0 0 8px; font-size: 17px; font-weight: 800; }
.num {
  display: grid; place-items: center; width: 30px; height: 30px; flex: none;
  font-size: 14px; font-weight: 800; color: var(--vv-accent-text); background: var(--vv-accent);
  border-radius: 10px;
}
.body { margin: 0 0 14px; font-size: 14px; line-height: 1.5; color: var(--vv-muted); }
.step .body:last-child { margin-bottom: 0; }
.create { display: grid; gap: 12px; }
.locked { margin: 0; font-weight: 600; }
.warn { margin: 0; font-size: 13px; font-weight: 700; color: var(--vv-negative); }

.how { margin: 0; padding-left: 22px; display: grid; gap: 12px; font-size: 14px; line-height: 1.5; }
.how li::marker { font-weight: 800; color: var(--vv-muted); }

.group { margin: 26px 0 10px; font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--vv-muted); }
.rows { padding: 6px 16px; }
.none { margin: 12px 0; font-size: 14px; color: var(--vv-muted); }
.device { display: flex; align-items: center; gap: 12px; padding: 12px 0; }
.device + .device { border-top: 1px solid var(--vv-shadow-dark); }
.d-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.d-main strong { font-size: 15px; }
.d-main small { font-size: 13px; color: var(--vv-muted); }
</style>
