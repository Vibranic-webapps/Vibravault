<script setup lang="ts">
import { House, List, Plus, Tag, User, PenLine, FileUp, ScanLine } from 'lucide-vue-next'

/**
 * The app shell (Redesign v2, Wave 2): logo header, the bottom bar
 * Home · Transactions · [+] · Categories · You, swiping between those four
 * screens, and the Add sheet behind the +.
 *
 * Settings, theme and sign-out left the header - they live in "You" now.
 */
const { t } = useI18n()
const route = useRoute()

const tabs = computed(() => [
  { to: '/', label: t('nav.home'), icon: House },
  { to: '/transactions', label: t('nav.transactions'), icon: List },
  { to: '/categories', label: t('nav.categories'), icon: Tag },
  { to: '/you', label: t('nav.you'), icon: User },
])
// The bar is split around the + button: two tabs left, two right.
const leftTabs = computed(() => tabs.value.slice(0, 2))
const rightTabs = computed(() => tabs.value.slice(2))

// Which tab lights up. Pages that live UNDER a tab light up their parent.
const activeTab = computed(() => (route.path === '/settings' ? '/you' : route.path))

// --- Swipe between the main screens --------------------------------------
const shell = ref<HTMLElement | null>(null)
useSwipeNav(shell)

// --- Add sheet ------------------------------------------------------------
const addOpen = ref(false)

async function go(path: string) {
  addOpen.value = false
  await navigateTo(path)
}
</script>

<template>
  <div ref="shell" class="shell">
    <header class="shell-head">
      <NuxtLink to="/" class="brand" :aria-label="t('brand.home')">
        <AppLogo />
      </NuxtLink>
    </header>

    <main class="shell-main">
      <slot />
    </main>

    <nav class="bar" :aria-label="t('nav.main')">
      <NuxtLink
        v-for="tab in leftTabs"
        :key="tab.to"
        :to="tab.to"
        class="tab"
        :class="{ on: activeTab === tab.to }"
        :aria-current="activeTab === tab.to ? 'page' : undefined"
      >
        <span class="tab-ic"><component :is="tab.icon" :size="21" aria-hidden="true" /></span>
        <span class="tab-label">{{ tab.label }}</span>
      </NuxtLink>

      <!-- Raised centre +. A <button>, not a link: it opens a sheet, it
           doesn't go anywhere - and a button reacts to EVERY tap (#13). -->
      <div class="add-slot">
        <button
          type="button"
          class="add"
          :aria-label="t('nav.add')"
          aria-haspopup="dialog"
          :aria-expanded="addOpen"
          @click="addOpen = true"
        >
          <Plus :size="26" :stroke-width="2.25" aria-hidden="true" />
        </button>
      </div>

      <NuxtLink
        v-for="tab in rightTabs"
        :key="tab.to"
        :to="tab.to"
        class="tab"
        :class="{ on: activeTab === tab.to }"
        :aria-current="activeTab === tab.to ? 'page' : undefined"
      >
        <span class="tab-ic"><component :is="tab.icon" :size="21" aria-hidden="true" /></span>
        <span class="tab-label">{{ tab.label }}</span>
      </NuxtLink>
    </nav>

    <UiBottomSheet v-model="addOpen" :title="t('add.title')">
      <UiListRow :icon="PenLine" :label="t('add.manual')" :hint="t('add.manualHint')" chevron @click="go('/transactions?new=1')" />
      <UiListRow :icon="FileUp" :label="t('add.import')" :hint="t('add.importHint')" chevron @click="go('/import')" />
      <UiListRow :icon="ScanLine" :label="t('add.receipt')" :hint="t('add.receiptHint')" :value="t('add.soon')" disabled />
    </UiBottomSheet>
  </div>
</template>

<style scoped>
/* overflow-x: clip on the FULL-WIDTH shell hides the few pixels a page
   slides during a tab transition, without clipping any card's shadow. */
.shell {
  min-height: 100vh; min-height: 100dvh; overflow-x: clip;
  padding-bottom: calc(116px + env(safe-area-inset-bottom));
}

.shell-head {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  max-width: 900px; margin: 0 auto;
  padding: calc(20px + env(safe-area-inset-top)) 24px 10px;
}
.brand { text-decoration: none; border-radius: var(--vv-r-badge); }
.brand:focus-visible { outline: 2px solid var(--vv-accent-ring); outline-offset: 4px; }

.shell-main { max-width: 900px; margin: 0 auto; padding: 8px 24px 24px; }

/* --- Bottom bar --------------------------------------------------------- */
.bar {
  position: fixed; z-index: 20;
  left: 50%; transform: translateX(-50%);
  bottom: calc(14px + env(safe-area-inset-bottom));
  width: calc(100% - 28px); max-width: 440px;
  display: grid; grid-template-columns: repeat(5, 1fr); align-items: end;
  padding: 8px 6px; border-radius: var(--vv-r-md);
  background: var(--vv-surface); box-shadow: var(--vv-e2);
}
.tab {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  min-height: 52px; justify-content: center;
  font-size: 11px; font-weight: 600; text-decoration: none;
  color: var(--vv-muted); -webkit-tap-highlight-color: transparent;
}
.tab-ic {
  display: grid; place-items: center; width: 46px; height: 30px;
  border-radius: var(--vv-r-badge); transition: box-shadow .14s ease, color .14s ease;
}
/* Active = pressed IN - the same inversion the whole system runs on. */
.tab.on { color: var(--vv-accent); }
.tab.on .tab-ic { box-shadow: var(--vv-p1); }
.tab:focus-visible { outline: none; }
.tab:focus-visible .tab-ic { outline: 2px solid var(--vv-accent-ring); outline-offset: 2px; }
.tab-label { white-space: nowrap; }

.add-slot { display: grid; place-items: center; }
.add {
  width: 56px; height: 56px; margin-top: -30px; /* raised out of the bar */
  display: grid; place-items: center;
  color: var(--vv-accent-text); background: var(--vv-accent);
  border: none; border-radius: var(--vv-r-md); box-shadow: var(--vv-e2);
  cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent;
  transition: transform .12s ease, box-shadow .12s ease;
}
.add:active { transform: translateY(1px) scale(.97); box-shadow: var(--vv-p1); }
.add:focus-visible { outline: 2px solid var(--vv-accent-ring); outline-offset: 3px; }

@media (max-width: 560px) {
  .shell-head { padding: calc(16px + env(safe-area-inset-top)) 18px 8px; }
  .shell-main { padding: 8px 18px 24px; }
}
@media (prefers-reduced-motion: reduce) {
  .tab-ic, .add { transition: none; }
}
</style>
