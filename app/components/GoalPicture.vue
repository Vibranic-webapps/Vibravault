<script setup lang="ts">
/**
 * A goal's picture, or - with none (or a link that broke) - the goal's first
 * letter on its tint. `fit`:
 *  - contain: the picture whole, inside the frame
 *  - cover:   the picture fills the frame (crops)
 *  - ambient: works with ANY size or shape. The whole picture is shown (contain)
 *             over a blurred, enlarged copy of itself that fills the frame, so
 *             nothing is cropped and there are no empty bars. `--pic-pad` sets how
 *             far the sharp picture stays from the frame's edges (e.g. to leave
 *             room for text).
 * Sizes itself to its parent: put it in a box with a height.
 * Emits `broken` when the image fails to load, so the card can switch to dark-on-tint text.
 */
const props = defineProps<{ src: string | null; name: string; fit?: 'contain' | 'cover' | 'ambient' }>()
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
    <img v-if="src && !failed && fit === 'ambient'" class="bg" :src="src" alt="" aria-hidden="true" decoding="async" referrerpolicy="no-referrer" draggable="false">
    <img
      v-if="src && !failed"
      class="main"
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
.pic { position: relative; display: grid; place-items: center; width: 100%; height: 100%; overflow: hidden; }
img { width: 100%; height: 100%; user-select: none; -webkit-user-drag: none; }
.contain img { object-fit: contain; padding: 8px; }
.cover img { object-fit: cover; }
.ambient .bg { position: absolute; inset: 0; object-fit: cover; transform: scale(1.3); filter: blur(18px) saturate(1.15); }
.ambient .main { position: absolute; inset: 0; box-sizing: border-box; object-fit: contain; padding: var(--pic-pad, 10px); }
.ph { font-size: 44px; font-weight: 800; color: var(--g-ink, var(--vv-goal)); opacity: .9; }
</style>
