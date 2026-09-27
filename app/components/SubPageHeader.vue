<script setup lang="ts">
import { ChevronLeft } from 'lucide-vue-next'

/** Title of a page one level down (You → Your rules), with the way back. */
defineProps<{ title: string; back: string }>()
const { t } = useI18n()
</script>

<template>
  <header class="sub-head">
    <UiIconButton :icon="ChevronLeft" :label="t('common.back')" :to="back" />
    <h1>{{ title }}</h1>
  </header>
</template>

<style scoped>
.sub-head { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; }
h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -.01em; }
</style>
