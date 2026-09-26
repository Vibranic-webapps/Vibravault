<script setup lang="ts">
interface ImportToken {
  id: string
  name: string
  lastUsedAt: string | null
  revokedAt: string | null
  createdAt: string
}

import { useRulesStore } from '~/stores/rules'
import { useCategoriesStore } from '~/stores/categories'

const user = useAuthUser()
const rules = useRulesStore()
const categories = useCategoriesStore()
await Promise.all([rules.fetchAll(), categories.fetchAll()])

async function removeRule(id: string, match: string) {
  if (!confirm(`Delete the rule for "${match}"? Its name disappears from every row. Categories it already set stay.`)) return
  await rules.remove(id)
}

const { data: tokens, refresh } = await useAsyncData<ImportToken[]>(
  'import-tokens',
  () => useRequestFetch()('/api/import-tokens'),
)

const newName = ref('iPhone Shortcut')
const created = ref<{ raw: string; name: string } | null>(null)
const busy = ref(false)
const copied = ref(false)

const origin = computed(() => (import.meta.client ? window.location.origin : 'https://vibravault.kilianfrederix.net'))

async function createToken() {
  busy.value = true
  try {
    created.value = await $fetch('/api/import-tokens', { method: 'POST', body: { name: newName.value } })
    await refresh()
  } finally {
    busy.value = false
  }
}

async function revoke(t: ImportToken) {
  if (!confirm(`Revoke "${t.name}"? Any Shortcut using it stops working immediately.`)) return
  await $fetch(`/api/import-tokens/${t.id}`, { method: 'DELETE' })
  await refresh()
}

async function copy(text: string) {
  await navigator.clipboard.writeText(text)
  copied.value = true
  setTimeout(() => (copied.value = false), 1800)
}

const active = computed(() => (tokens.value ?? []).filter((t) => !t.revokedAt))
</script>

<template>
  <div>
    <h1>Settings</h1>
    <p class="muted">{{ user?.email }}</p>

    <!-- Taught rules -->
    <section id="rules" class="neu-3 card">
      <h2>Rules you've taught</h2>
      <p class="body">
        Created from a transaction's <strong>⋯ → Rename &amp; categorise all like this</strong>.
        The most specific rule wins when several match.
      </p>

      <p v-if="!rules.items.length" class="empty">No rules yet.</p>

      <div v-else class="rows">
        <div
          v-for="(r, i) in rules.items"
          :key="r.id"
          class="row"
          :class="{ 'neu-divider': i < rules.items.length - 1 }"
        >
          <span class="r-main">
            <strong>{{ r.label ?? 'No new name' }}</strong>
            <small>
              contains “{{ r.match }}”
              <template v-if="r.categoryId && categories.byId.get(r.categoryId)">
                → {{ categories.byId.get(r.categoryId)!.icon }} {{ categories.byId.get(r.categoryId)!.name }}
              </template>
            </small>
          </span>
          <button class="link-btn danger" type="button" @click="removeRule(r.id, r.match)">Delete</button>
        </div>
      </div>
    </section>

    <!-- Import tokens -->
    <section id="phone" class="neu-3 card">
      <h2>Share a CSV from your phone</h2>
      <p class="body">
        iOS doesn't let a web app join the share sheet, but an
        <strong>Apple Shortcut</strong> can. Create a token below, build the Shortcut once,
        and afterwards you share the file straight from your banking app.
      </p>

      <!-- The one and only moment the raw token exists -->
      <div v-if="created" class="neu-pressed-2 reveal">
        <p class="reveal-label">Copy this now — it is never shown again</p>
        <code class="token">{{ created.raw }}</code>
        <button class="vv-btn small" type="button" @click="copy(created.raw)">
          {{ copied ? 'Copied ✓' : 'Copy token' }}
        </button>
      </div>

      <div v-if="active.length" class="rows">
        <div
          v-for="(t, i) in active"
          :key="t.id"
          class="row"
          :class="{ 'neu-divider': i < active.length - 1 }"
        >
          <span class="r-main">
            <strong>{{ t.name }}</strong>
            <small>{{ t.lastUsedAt ? `last used ${new Date(t.lastUsedAt).toLocaleDateString('en-GB')}` : 'never used' }}</small>
          </span>
          <button class="link-btn danger" type="button" @click="revoke(t)">Revoke</button>
        </div>
      </div>

      <div class="create">
        <input v-model="newName" class="vv-field" maxlength="40" placeholder="Name this device" />
        <button class="vv-btn narrow" type="button" :disabled="busy" @click="createToken">
          {{ busy ? 'Creating…' : 'New token' }}
        </button>
      </div>

      <details class="how">
        <summary>How to build the Shortcut (once, ~5 minutes)</summary>
        <ol>
          <li>Open <strong>Shortcuts</strong> → <strong>+</strong> → <strong>Add Action</strong> → <em>Get Contents of URL</em>.</li>
          <li>URL: <code>{{ origin }}/api/import/shortcut</code></li>
          <li>Method: <strong>POST</strong></li>
          <li>Headers: add <code>x-import-token</code> with the token above.</li>
          <li>Request Body: <strong>File</strong> → choose <em>Shortcut Input</em>.</li>
          <li>Add <em>Get Dictionary Value</em> → key <code>summary</code>, then <em>Show Notification</em>.</li>
          <li>In the Shortcut's settings (ⓘ), turn on <strong>Show in Share Sheet</strong> and accept <strong>Files</strong>.</li>
        </ol>
        <p class="note">
          Then: banking app → Share → your Shortcut. It parses, skips duplicates and
          tells you what it did. There's no preview step, so the balance check is your
          safety net — the notification says if it fails.
        </p>
      </details>
    </section>
  </div>
</template>

<style scoped>
h1 { margin: 0 0 4px; font-size: 26px; }
h2 { margin: 0 0 12px; font-size: 15px; font-weight: 700; }
.muted { margin: 0 0 22px; color: var(--vv-muted); font-size: 14px; }
.body { margin: 0 0 16px; font-size: 14px; color: var(--vv-muted); max-width: 60ch; }
.card { padding: 22px; margin-bottom: 20px; }


.reveal { padding: 16px; margin-bottom: 16px; }
.reveal-label { margin: 0 0 8px; font-size: 12px; font-weight: 700; color: var(--vv-negative); }
.token { display: block; margin-bottom: 12px; font-family: ui-monospace, monospace; font-size: 12px; word-break: break-all; color: var(--vv-text); }
.small { width: auto; padding: 8px 14px; font-size: 13px; }

.rows { margin-bottom: 16px; }
.empty { margin: 0; font-size: 13px; color: var(--vv-muted-2); }
.row { display: flex; align-items: center; gap: 12px; padding: 11px 0; }
.r-main { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.r-main strong { font-size: 14px; }
.r-main small { font-size: 12px; color: var(--vv-muted-2); }
.link-btn { padding: 6px 10px; font: inherit; font-size: 13px; font-weight: 600; color: var(--vv-muted); background: none; border: none; cursor: pointer; }
.link-btn.danger:hover { color: var(--vv-negative); }

.create { display: flex; gap: 10px; align-items: center; }
.narrow { width: auto; white-space: nowrap; }

.how { margin-top: 18px; font-size: 13px; color: var(--vv-muted); }
.how summary { cursor: pointer; font-weight: 600; color: var(--vv-text); }
.how ol { margin: 12px 0; padding-left: 20px; display: grid; gap: 7px; }
.how code { padding: 2px 6px; font-size: 12px; background: var(--vv-surface); box-shadow: var(--vv-p1); border-radius: 6px; word-break: break-all; }
.note { margin: 10px 0 0; font-size: 12px; color: var(--vv-muted-2); }
</style>
