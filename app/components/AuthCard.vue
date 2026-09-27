<script setup lang="ts">
/**
 * The frame of every signed-out screen (sign in, create account, forgot,
 * reset): one card with the brand tag hanging off its top edge, slightly
 * rotated - the look Kilian approved - plus a language switch underneath,
 * because the You tab (where language normally lives) isn't reachable yet.
 */
defineProps<{ title: string; sub?: string }>()
const { t, locale, setLocale } = useI18n()
</script>

<template>
  <main class="page">
    <div class="neu-3 card">
      <!-- Brand tag: hangs off the top edge of the card, slightly rotated. -->
      <p class="brand">Vibravault</p>
      <h1>{{ title }}</h1>
      <p v-if="sub" class="sub">{{ sub }}</p>
      <slot />
    </div>

    <div class="lang" role="group" :aria-label="t('language.label')">
      <button type="button" :class="{ on: locale === 'en' }" :aria-pressed="locale === 'en'" @click="setLocale('en')">English</button>
      <span aria-hidden="true">·</span>
      <button type="button" :class="{ on: locale === 'nl' }" :aria-pressed="locale === 'nl'" @click="setLocale('nl')">Nederlands</button>
    </div>
  </main>
</template>

<style scoped>
.page {
  min-height: 100vh; min-height: 100dvh;
  display: grid; place-content: center; justify-items: center; gap: 22px;
  padding: calc(48px + env(safe-area-inset-top)) 22px calc(24px + env(safe-area-inset-bottom));
}

/* position:relative anchors the brand tag; the extra top padding makes room
   for the half of it that overhangs the card. */
.card { position: relative; width: min(420px, calc(100vw - 44px)); padding: 46px 28px 30px; }

.brand {
  position: absolute; top: -17px; left: 50%;
  /* translate first, then rotate - rotating first would swing the element
     around and break the centring. */
  transform: translateX(-50%) rotate(-3deg);
  margin: 0; padding: 9px 22px;
  font-size: 12px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; white-space: nowrap;
  color: #fff; background: var(--vv-brand);
  border-radius: 14px; box-shadow: var(--vv-e2);
}

h1 { margin: 0 0 4px; font-size: 26px; font-weight: 800; text-align: center; }
.sub { margin: 0 0 24px; color: var(--vv-muted); font-size: 15px; line-height: 1.45; text-align: center; }

.lang { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--vv-muted-2); }
.lang button {
  padding: 6px 4px; font: inherit; font-weight: 600; color: var(--vv-muted);
  background: none; border: none; cursor: pointer;
}
.lang button.on { color: var(--vv-accent); }
.lang button:focus-visible { outline: 2px solid var(--vv-accent-ring); outline-offset: 2px; border-radius: 6px; }
</style>
