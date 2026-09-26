<script setup lang="ts">
import {
  House, List, Plus, Tag, User, ScanLine, Upload, Pencil, Trash2, CreditCard,
  ChartColumn, Languages, Smartphone, LogOut, Sparkles, Save, Receipt, Wallet,
  ArrowLeftRight, Download,
} from 'lucide-vue-next'

definePageMeta({ layout: false })

/**
 * The living style guide - every building block of v2 on one page, in both
 * themes and both languages. This is where Wave 1 gets reviewed on the phone.
 * Behind the global auth middleware, so not public.
 */
const { t, locale, setLocale } = useI18n()
const theme = useTheme()
const { money, date } = useFormat()
const { toast } = useToast()

const lang = computed({
  get: () => locale.value,
  set: (v: string) => setLocale(v as 'en' | 'nl'),
})

// Field demo state
const name = ref('')
const amount = ref('42,18')
const when = ref('2026-09-24')
const cat = ref('groceries')
const bad = ref('abc')
const direction = ref('out')
const filter = ref('all')
const month = ref('2026-09')
const sheetOpen = ref(false)

const icons = [House, List, Plus, Tag, User, ScanLine, Upload, Pencil, Trash2, CreditCard, ChartColumn, Receipt, Wallet, ArrowLeftRight, Smartphone, Download]
const tints = Array.from({ length: 12 }, (_, i) => `cat-${i + 1}`)
</script>

<template>
  <main class="page">
    <header class="head">
      <div>
        <p class="eyebrow">Vibravault</p>
        <h1>{{ t('design.title') }}</h1>
        <p class="muted">{{ t('design.intro') }}</p>
      </div>
    </header>

    <div class="switches">
      <UiSegmented
        v-model="lang"
        :label="t('language.label')"
        :options="[{ value: 'en', label: 'English' }, { value: 'nl', label: 'Nederlands' }]"
      />
      <UiSegmented
        v-model="theme"
        :label="t('theme.label')"
        :options="[{ value: 'system', label: t('theme.system') }, { value: 'light', label: t('theme.light') }, { value: 'dark', label: t('theme.dark') }]"
      />
    </div>

    <!-- Typeface -->
    <section>
      <h2>{{ t('design.type') }} · Plus Jakarta Sans</h2>
      <div class="neu-3 panel">
        <p class="balance">{{ money(123456) }}</p>
        <p class="headline"><strong>{{ t('design.typeSample') }}</strong> <span>{{ t('design.typeSampleLight') }}</span></p>
        <p class="weights">
          <span style="font-weight: 300">Light 300</span>
          <span style="font-weight: 400">Regular 400</span>
          <span style="font-weight: 600">Semibold 600</span>
          <span style="font-weight: 800">Extrabold 800</span>
        </p>
      </div>
    </section>

    <!-- Money -->
    <section>
      <h2>{{ t('design.money') }}</h2>
      <div class="neu-3 panel money">
        <span class="vv-amount-in">{{ money(41260, { signed: true }) }}</span>
        <span class="vv-amount-out">{{ money(-4218) }}</span>
        <span class="vv-amount-transfer">{{ money(-3000) }}</span>
        <span class="muted">{{ date('2026-09-24') }} · {{ date('2026-09-24', { weekday: 'long', day: 'numeric', month: 'long' }) }}</span>
      </div>
    </section>

    <!-- Icons -->
    <section>
      <h2>{{ t('design.icons') }} · Lucide</h2>
      <div class="icons">
        <UiIconTile v-for="(ic, i) in icons" :key="i" :icon="ic" />
      </div>
      <div class="icons tints">
        <UiIconTile v-for="(tint, i) in tints" :key="tint" :icon="icons[i % icons.length]!" :tint="tint" />
      </div>
    </section>

    <!-- Fields -->
    <section>
      <h2>{{ t('design.fields') }}</h2>
      <div class="neu-3 panel stack">
        <UiField v-model="amount" :label="t('design.fieldAmount')" prefix="€" inputmode="decimal" size="lg" />
        <UiField v-model="name" :label="t('design.fieldName')" :placeholder="t('design.fieldNamePh')" />
        <UiField v-model="when" :label="t('design.fieldDate')" type="date" />
        <UiField
          v-model="cat"
          :label="t('design.fieldCategory')"
          as="select"
          :options="[{ value: 'groceries', label: '🛒 Groceries' }, { value: 'housing', label: '🏠 Housing' }]"
        />
        <UiField v-model="bad" :label="t('design.fieldError')" :error="t('design.fieldErrorMsg')" />
      </div>
    </section>

    <!-- Buttons -->
    <section>
      <h2>{{ t('design.buttons') }}</h2>
      <div class="neu-3 panel stack">
        <UiButton :icon="Save">{{ t('design.primary') }}</UiButton>
        <UiButton variant="ghost">{{ t('design.ghost') }}</UiButton>
        <UiButton variant="danger" :icon="Trash2">{{ t('design.danger') }}</UiButton>
        <UiButton loading>{{ t('design.primary') }}</UiButton>
        <div class="iconbtns">
          <UiIconButton :icon="Pencil" :label="t('common.edit')" />
          <UiIconButton :icon="Trash2" :label="t('common.delete')" />
          <UiIconButton :icon="Plus" label="Add" active />
          <UiIconButton :icon="User" label="You" size="sm" />
        </div>
      </div>
    </section>

    <!-- Choices -->
    <section>
      <h2>{{ t('design.choices') }}</h2>
      <div class="neu-3 panel stack">
        <UiSegmented
          v-model="direction"
          :label="t('design.choices')"
          :options="[{ value: 'out', label: t('design.moneyOut') }, { value: 'in', label: t('design.moneyIn') }]"
        />
        <div class="chips">
          <UiChip :active="filter === 'all'" @click="filter = 'all'">{{ t('design.filterAll') }}</UiChip>
          <UiChip :active="filter === 'sort'" :count="4" @click="filter = 'sort'">{{ t('design.filterUncategorised') }}</UiChip>
          <UiChip :active="filter === 'in'" @click="filter = 'in'">{{ t('design.moneyIn') }}</UiChip>
          <UiChip :active="filter === 'out'" @click="filter = 'out'">{{ t('design.moneyOut') }}</UiChip>
        </div>
      </div>
    </section>

    <!-- Month switcher -->
    <section>
      <h2>{{ t('design.month') }}</h2>
      <div class="neu-3 panel">
        <UiMonthSwitcher v-model="month" />
      </div>
    </section>

    <!-- List rows -->
    <section>
      <h2>{{ t('design.rows') }}</h2>
      <div class="neu-3 panel">
        <UiListRow :icon="Languages" :label="t('design.rowLanguage')" :value="locale === 'nl' ? 'Nederlands' : 'English'" to="/design" />
        <UiListRow :icon="Sparkles" :label="t('design.rowRules')" value="3" to="/design" />
        <UiListRow :icon="LogOut" :label="t('design.rowSignOut')" danger />
      </div>
    </section>

    <!-- Sheet + toast -->
    <section>
      <h2>{{ t('design.sheet') }}</h2>
      <div class="neu-3 panel stack">
        <UiButton variant="ghost" @click="sheetOpen = true">{{ t('design.openSheet') }}</UiButton>
        <UiButton variant="ghost" @click="toast(t('design.toastMsg'))">{{ t('design.toast') }}</UiButton>
      </div>
    </section>

    <UiBottomSheet v-model="sheetOpen" :title="t('design.sheetTitle')">
      <p class="muted">{{ t('design.sheetBody') }}</p>
      <div class="stack" style="margin-top: 16px">
        <UiListRow :icon="Pencil" :label="t('design.fieldName')" chevron @click="sheetOpen = false" />
        <UiListRow :icon="Upload" label="CSV" chevron @click="sheetOpen = false" />
        <UiListRow :icon="ScanLine" label="Receipt" chevron @click="sheetOpen = false" />
      </div>
    </UiBottomSheet>

    <p class="foot"><NuxtLink class="vv-link" to="/">{{ t('common.back') }}</NuxtLink></p>
  </main>
</template>

<style scoped>
.page { max-width: 720px; margin: 0 auto; padding: calc(36px + env(safe-area-inset-top)) 20px calc(80px + env(safe-area-inset-bottom)); }
.eyebrow { margin: 0 0 4px; font-size: 12px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--vv-brand); }
h1 { margin: 0 0 6px; font-size: 30px; font-weight: 800; }
h2 { margin: 0 0 12px; font-size: 13px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--vv-muted); }
.muted { margin: 0; color: var(--vv-muted); font-size: 14px; }
.switches { display: grid; gap: 12px; margin: 22px 0 34px; }
section { margin-bottom: 34px; }
.panel { padding: 22px; }
.stack { display: grid; gap: 16px; }

.balance { margin: 0 0 12px; font-size: 38px; font-weight: 800; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.headline { margin: 0 0 14px; font-size: 22px; line-height: 1.2; }
.headline strong { display: block; font-weight: 800; }
.headline span { font-weight: 300; color: var(--vv-muted); }
.weights { display: flex; flex-wrap: wrap; gap: 14px; margin: 0; font-size: 14px; color: var(--vv-muted); }

.money { display: flex; flex-wrap: wrap; align-items: center; gap: 18px; font-size: 17px; font-weight: 700; }

.icons { display: flex; flex-wrap: wrap; gap: 12px; }
.tints { margin-top: 14px; }
.iconbtns { display: flex; gap: 12px; }
.chips { display: flex; gap: 8px; overflow-x: auto; padding: 4px 2px 8px; }
.foot { text-align: center; }
</style>
