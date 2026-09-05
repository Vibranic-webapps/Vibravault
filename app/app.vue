<script setup lang="ts">
const theme = useTheme()

// 'system' writes no attribute, letting the prefers-color-scheme media query
// decide. Rendered server-side, so there is no wrong-theme flash on load.
useHead({
  htmlAttrs: {
    'data-theme': computed(() => (theme.value === 'system' ? undefined : theme.value)),
  },
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
