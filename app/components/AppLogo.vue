<script setup lang="ts">
/**
 * THE logo slot (#11). Placeholder mark until the real logo exists - when it
 * does, replace the <span class="mark"> with the SVG and nothing else in the
 * app has to change. `wordmark` = show the name next to the mark.
 */
withDefaults(defineProps<{ wordmark?: boolean }>(), { wordmark: true })
</script>

<template>
  <span class="logo">
    <span class="mark neu" aria-hidden="true">V</span>
    <span v-if="wordmark" class="word">Vibravault</span>
  </span>
</template>

<style scoped>
.logo { display: inline-flex; align-items: center; gap: 10px; }
.mark {
  display: grid; place-items: center; width: 34px; height: 34px;
  font-size: 17px; font-weight: 800; color: var(--vv-accent-text);
  background: var(--vv-accent); border-radius: var(--vv-r-badge);
}
.word { font-size: 17px; font-weight: 800; letter-spacing: -.01em; color: var(--vv-text); }
</style>
