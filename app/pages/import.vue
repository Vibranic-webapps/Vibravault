<script setup lang="ts">
import { formatCents } from '~~/shared/utils/money'
import { transactionLabel } from '~~/shared/utils/merchant'

interface PreviewRow {
  bookedAt: string
  amountCents: number
  balanceAfterCents: number | null
  description: string
  counterpartyIban: string | null
  duplicate: boolean
  lineNumber: number
}
interface Preview {
  filename: string
  meta: {
    delimiter: string; encoding: string; headerCount: number; dataRows: number
    balanceCheck: { ok: boolean; checked: number; firstMismatchLine: number | null }
  }
  errors: { line: number; reason: string }[]
  rows: PreviewRow[]
  newCount: number
  duplicateCount: number
}

const file = ref<File | null>(null)
const preview = ref<Preview | null>(null)
const result = ref<{ inserted: number; skipped: number } | null>(null)
const error = ref<string | null>(null)
const busy = ref(false)

function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  file.value = input.files?.[0] ?? null
  preview.value = null
  result.value = null
  error.value = null
  if (file.value) doPreview()
}

async function post<T>(url: string): Promise<T> {
  const body = new FormData()
  body.append('file', file.value!)
  return $fetch<T>(url, { method: 'POST', body })
}

async function doPreview() {
  busy.value = true
  error.value = null
  try {
    preview.value = await post<Preview>('/api/import/preview')
  } catch (e: any) {
    error.value = e?.statusMessage ?? 'Could not read that file'
  } finally {
    busy.value = false
  }
}

async function doCommit() {
  busy.value = true
  error.value = null
  try {
    result.value = await post('/api/import/commit')
    preview.value = null
  } catch (e: any) {
    error.value = e?.statusMessage ?? 'Import failed'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <h1>Import</h1>
    <p class="muted">Upload a CSV export from your bank. Nothing is written until you confirm.</p>

    <p v-if="error" class="vv-error">{{ error }}</p>

    <!-- Step 1: pick a file -->
    <div class="neu-3 card">
      <label class="drop">
        <input type="file" accept=".csv,text/csv" class="file" @change="onPick" />
        <span class="drop-icon" aria-hidden="true">⇪</span>
        <span class="drop-main">{{ file ? file.name : 'Choose a CSV file' }}</span>
        <span class="drop-sub">KBC export · max 5 MB</span>
      </label>
    </div>

    <!-- Step 2: preview -->
    <section v-if="preview" class="neu-3 card">
      <h2>{{ preview.filename }}</h2>

      <div class="stats">
        <div><span class="s-label">New</span><span class="s-value in">{{ preview.newCount }}</span></div>
        <div><span class="s-label">Already there</span><span class="s-value">{{ preview.duplicateCount }}</span></div>
        <div><span class="s-label">Unreadable</span><span class="s-value" :class="preview.errors.length ? 'out' : ''">{{ preview.errors.length }}</span></div>
      </div>

      <!-- The bank's own running balance is a checksum. Saying so out loud is
           what makes an importer feel trustworthy rather than scary. -->
      <p class="check" :class="preview.meta.balanceCheck.ok ? 'ok' : 'bad'">
        <template v-if="preview.meta.balanceCheck.ok">
          ✓ Balance check passed — {{ preview.meta.balanceCheck.checked }} running totals match the bank
        </template>
        <template v-else>
          ⚠ Balance mismatch from line {{ preview.meta.balanceCheck.firstMismatchLine }} — a row may be missing
        </template>
      </p>

      <p class="meta">
        {{ preview.meta.dataRows }} rows · {{ preview.meta.headerCount }} columns ·
        delimiter “{{ preview.meta.delimiter }}” · {{ preview.meta.encoding }}
      </p>

      <ul v-if="preview.errors.length" class="errs">
        <li v-for="e in preview.errors" :key="e.line">Line {{ e.line }}: {{ e.reason }}</li>
      </ul>

      <div class="rows">
        <div
          v-for="(r, i) in preview.rows"
          :key="r.lineNumber"
          class="row"
          :class="{ dim: r.duplicate, 'neu-divider': i < preview.rows.length - 1 }"
        >
          <span class="badge" :class="r.duplicate ? 'dup' : 'new'">{{ r.duplicate ? 'dup' : 'new' }}</span>
          <span class="r-main">
            <strong>{{ transactionLabel(null, r.description) }}</strong>
            <small>{{ r.bookedAt }}</small>
          </span>
          <span :class="r.amountCents < 0 ? 'vv-amount-out' : 'vv-amount-in'">
            {{ formatCents(r.amountCents, { signed: r.amountCents > 0 }) }}
          </span>
        </div>
      </div>

      <button
        class="vv-btn commit"
        type="button"
        :disabled="busy || preview.newCount === 0"
        @click="doCommit"
      >
        {{ preview.newCount ? `Import ${preview.newCount} transaction${preview.newCount === 1 ? '' : 's'}` : 'Nothing new to import' }}
      </button>
    </section>

    <!-- Step 3: done -->
    <section v-if="result" class="neu-3 card done">
      <p class="done-title">Imported</p>
      <p class="done-body">
        {{ result.inserted }} added · {{ result.skipped }} already there
      </p>
      <NuxtLink class="vv-btn narrow" to="/transactions">Categorise them</NuxtLink>
    </section>
  </div>
</template>

<style scoped>
h1 { margin: 0 0 4px; font-size: 26px; }
h2 { margin: 0 0 14px; font-size: 15px; font-weight: 700; word-break: break-all; }
.muted { margin: 0 0 22px; color: var(--vv-muted); font-size: 14px; }
.card { padding: 22px; margin-bottom: 20px; }

.drop {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 30px 20px; cursor: pointer; text-align: center;
  border-radius: var(--vv-r-md); box-shadow: var(--vv-p2);
}
.file { position: absolute; width: 1px; height: 1px; opacity: 0; }
.drop-icon { font-size: 26px; color: var(--vv-accent); }
.drop-main { font-size: 15px; font-weight: 600; word-break: break-all; }
.drop-sub { font-size: 12px; color: var(--vv-muted-2); }

.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; text-align: center; }
.stats div { display: flex; flex-direction: column; gap: 2px; }
.s-label { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--vv-muted-2); }
.s-value { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }
.in { color: var(--vv-accent); }
.out { color: var(--vv-negative); }

.check { margin: 0 0 8px; padding: 10px 12px; font-size: 13px; font-weight: 600; border-radius: var(--vv-r-sm); }
.check.ok { color: var(--vv-accent); background: color-mix(in srgb, var(--vv-accent) 10%, transparent); }
.check.bad { color: var(--vv-negative); background: var(--vv-negative-bg); }
.meta { margin: 0 0 14px; font-size: 12px; color: var(--vv-muted-2); }
.errs { margin: 0 0 14px; padding-left: 18px; font-size: 12px; color: var(--vv-negative); }

.rows { max-height: 320px; overflow-y: auto; }
.row { display: flex; align-items: center; gap: 12px; padding: 11px 0; }
.row.dim { opacity: .45; }
.badge {
  flex: none; padding: 3px 8px; font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .05em; border-radius: var(--vv-r-badge); box-shadow: var(--vv-e1);
}
.badge.new { color: var(--vv-accent); }
.badge.dup { color: var(--vv-muted-2); }
.r-main { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.r-main strong { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.r-main small { font-size: 11px; color: var(--vv-muted); }
.row > span:last-child { font-size: 13px; font-weight: 700; white-space: nowrap; }

.commit { margin-top: 18px; }
.done { text-align: center; }
.done-title { margin: 0 0 4px; font-size: 18px; font-weight: 700; color: var(--vv-accent); }
.done-body { margin: 0 0 18px; font-size: 14px; color: var(--vv-muted); }
.narrow { max-width: 240px; margin: 0 auto; display: block; text-align: center; text-decoration: none; }
</style>
