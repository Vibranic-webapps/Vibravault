<script setup lang="ts">
/**
 * A goal's picture, or - with none (or a link that broke) - the goal's first
 * letter on its tint. `fit="contain"` shows a cut-out whole; `cover` fills the
 * frame. Sizes itself to its parent: put it in a box with a height.
 * Emits `broken` when the image fails to load, so the card can switch to dark-on-tint text.
 */
const props = defineProps<{ src: string | null; name: string; fit?: 'contain' | 'cover' }>()
const emit = defineEmits<{ broken: [] }>()

const failed = ref(false)
watch(() => props.src, () => { failed.value = false })
function onError() {
  failed.value = true
  emit('broken')
}
const initial = computed(() => (props.name.trim()[0] ?? '?').toUpperCase())
</script>

<template>
  <span class="pic" :class="fit ?? 'contain'">
    <img
      v-if="src && !failed"
      :src="src"
      alt=""
      decoding="async"
      loading="lazy"
      referrerpolicy="no-referrer"
      draggable="false"
      @error="onError"
    >
    <span v-else class="ph" aria-hidden="true">{{ initial }}</span>
  </span>
</template>

<style scoped>
.pic { display: grid; place-items: center; width: 100%; height: 100%; overflow: hidden; }
img { width: 100%; height: 100%; user-select: none; -webkit-user-drag: none; }
.contain img { object-fit: contain; padding: 8px; }
.cover img { object-fit: cover; }
.ph { font-size: 44px; font-weight: 800; color: var(--g-ink, var(--vv-goal)); opacity: .9; }
</style>
