<script setup lang="ts">
const theme = useTheme()

// <html lang> must follow the app language. Screen readers pick their
// pronunciation from it (Dutch read with English rules is unintelligible) and
// iOS uses it for spellcheck. The i18n module does NOT set it on its own -
// useLocaleHead() provides it and it has to be wired in here.
const i18nHead = useLocaleHead()

useHead({
  htmlAttrs: {
    lang: computed(() => i18nHead.value.htmlAttrs?.lang),
    // 'system' writes no attribute, letting the prefers-color-scheme media
    // query decide. Rendered server-side, so no wrong-theme flash on load.
    'data-theme': computed(() => (theme.value === 'system' ? undefined : theme.value)),
  },
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <!-- Global, not in a layout: pages without the app shell (login, /design)
       must be able to show a toast too. -->
  <UiToaster />
</template>
