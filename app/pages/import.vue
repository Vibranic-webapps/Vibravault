<script setup lang="ts">
import { FileUp, CircleCheck, TriangleAlert, Smartphone } from 'lucide-vue-next'

/**
 * Import from your bank (Redesign v2, Wave 3).
 *   1. pick the CSV your banking app exported
 *   2. see what's in it: new / already known / unreadable, and whether the
 *      bank's running balance adds up (the signal that a row went missing)
 *   3. "Review N transactions" -> the same review sheet as the Shortcut
 * Nothing counts until it's added there.
 */
interface UploadResult {
  filename: string
  rows: number
  waiting: number
  skipped: number
  errors: { line: number; reason: string }[]
  balanceCheck: { ok: boolean; checked: number; firstMismatchLine: number | null }
}

const { t } = useI18n()
const pending = usePending()

const input = ref<HTMLInputElement | null>(null)
const busy = ref(false)
const error = ref('')
const result = ref<UploadResult | null>(null)

async function onPick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  busy.value = true
  error.value = ''
  result.value = null
  try {
    const body = new FormData()
    body.append('file', file)
    result.value = await $fetch<UploadResult>('/api/import/upload', { method: 'POST', body })
    await pending.refresh()
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode
    error.value = status === 413 ? t('import.tooBig') : t('import.badFile')
  } finally {
    busy.value = false
    // Same file picked again must still fire "change".
    if (input.value) input.value.value = ''
  }
}

function again() {
  result.value = null
  error.value = ''
  input.value?.click()
}
</script>

<template>
  <div>
    <SubPageHeader :title="t('import.title')" back="/" />
    <p class="intro">{{ t('import.intro') }}</p>

    <!-- The whole card is the file button: big target, one tap. -->
    <label v-if="!result" class="pick" :class="{ busy }">
      <input
        ref="input"
        type="file"
        accept=".csv,text/csv,text/comma-separated-values"
        class="sr"
        :disabled="busy"
        @change="onPick"
      />
      <UiIconTile :icon="FileUp" size="lg" />
      <strong>{{ busy ? t('import.reading') : t('import.choose') }}</strong>
      <small>{{ t('import.chooseHint') }}</small>
    </label>

    <p v-if="error" class="vv-error" role="alert">{{ error }}</p>

    <section v-if="result" class="neu-3 card" aria-live="polite">
      <h2 class="file">{{ result.filename }}</h2>

      <div class="stats">
        <div class="stat"><strong class="vv-amount-in">{{ result.waiting }}</strong><small>{{ t('import.new') }}</small></div>
        <div class="stat"><strong>{{ result.skipped }}</strong><small>{{ t('import.known') }}</small></div>
        <div class="stat"><strong :class="{ 'vv-amount-out': result.errors.length }">{{ result.errors.length }}</strong><small>{{ t('import.unreadable') }}</small></div>
      </div>

      <p v-if="result.balanceCheck.checked" class="check" :class="result.balanceCheck.ok ? 'ok' : 'bad'">
        <component :is="result.balanceCheck.ok ? CircleCheck : TriangleAlert" :size="18" aria-hidden="true" />
        <span>
          {{ result.balanceCheck.ok
            ? t('import.balanceOk')
            : t('import.balanceBad', { line: result.balanceCheck.firstMismatchLine }) }}
        </span>
      </p>

      <details v-if="result.errors.length" class="errs">
        <summary>{{ t('import.unreadableTitle') }}</summary>
        <ul>
          <li v-for="e in result.errors" :key="e.line"><strong>{{ t('import.line', { line: e.line }) }}</strong> {{ e.reason }}</li>
        </ul>
      </details>

      <div class="actions">
        <UiButton v-if="pending.items.value.length" @click="pending.open.value = true">
          {{ t('import.review', pending.items.value.length) }}
        </UiButton>
        <p v-else class="nothing">{{ t('import.nothingNew') }}</p>
        <UiButton variant="ghost" @click="again">{{ t('import.another') }}</UiButton>
      </div>
      <!-- Kept mounted for "Import another file". -->
      <input ref="input" type="file" accept=".csv,text/csv,text/comma-separated-values" class="sr" @change="onPick" />
    </section>

    <section class="neu-3 card tip">
      <UiIconTile :icon="Smartphone" size="sm" />
      <p>
        {{ t('import.tip') }}
        <NuxtLink class="vv-link" to="/you/phone">{{ t('import.tipLink') }}</NuxtLink>
      </p>
    </section>
  </div>
</template>

<style scoped>
.intro { margin: 0 0 20px; font-size: 15px; line-height: 1.5; color: var(--vv-muted); }

.pick {
  display: grid; justify-items: center; gap: 8px; padding: 34px 20px; margin-bottom: 18px;
  text-align: center; border-radius: var(--vv-r-lg); box-shadow: var(--vv-p2); cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.pick strong { margin-top: 6px; font-size: 17px; font-weight: 800; }
.pick small { font-size: 13px; color: var(--vv-muted); }
.pick.busy { cursor: progress; opacity: .7; }
.pick:focus-within { outline: 2px solid var(--vv-accent-ring); outline-offset: 3px; }
.sr { position: absolute; width: 1px; height: 1px; opacity: 0; overflow: hidden; }

.card { padding: 20px; margin-bottom: 18px; }
.file { margin: 0 0 16px; font-size: 15px; font-weight: 700; overflow-wrap: anywhere; }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
.stat { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 12px 6px; border-radius: var(--vv-r-sm); box-shadow: var(--vv-p1); }
.stat strong { font-size: 24px; font-weight: 800; font-variant-numeric: tabular-nums; }
.stat small { font-size: 12px; color: var(--vv-muted); text-align: center; }

.check { display: flex; gap: 10px; align-items: flex-start; margin: 0 0 14px; font-size: 14px; line-height: 1.45; }
.check.ok { color: var(--vv-accent); }
.check.bad { color: var(--vv-negative); font-weight: 600; }
.check svg { flex: none; margin-top: 1px; }

.errs { margin-bottom: 14px; font-size: 13px; }
.errs summary { cursor: pointer; font-weight: 600; color: var(--vv-muted); }
.errs ul { margin: 10px 0 0; padding-left: 18px; display: grid; gap: 4px; color: var(--vv-muted); }

.actions { display: grid; gap: 10px; }
.nothing { margin: 0; font-size: 14px; text-align: center; color: var(--vv-muted); }

.tip { display: flex; align-items: center; gap: 14px; }
.tip p { margin: 0; font-size: 14px; line-height: 1.45; color: var(--vv-muted); }
</style>
