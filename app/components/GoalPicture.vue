<script setup lang="ts">
/**
 * A goal's picture, or - with none (or a link that broke) - the goal's first
 * letter on its tint. `fit="contain"` shows a cut-out whole; `cover` fills the
 * frame. Sizes itself to its parent: put it in a box with a height.
 * Emits `broken` when the image fails to load, so the card can switch to dark-on-tint text.
 */
const props = defineProps<{
  src: string | null
  name: string
  fit?: 'contain' | 'cover'
  /** Which part of a `cover` picture shows: focus point in % and zoom in % (100 = none). */
  focusX?: number
  focusY?: number
  zoom?: number
}>()
const emit = defineEmits<{ broken: [] }>()

const failed = ref(false)
watch(() => props.src, () => { failed.value = false })
function onError() {
  failed.value = true
  emit('broken')
}
// Same numbers -> same crop everywhere (Home card, drawer, form preview, editor).
const imgStyle = computed(() => {
  if (props.fit !== 'cover') return undefined
  const x = props.focusX ?? 50
  const y = props.focusY ?? 50
  const z = (props.zoom ?? 100) / 100
  return { objectPosition: `${x}% ${y}%`, transformOrigin: `${x}% ${y}%`, transform: z === 1 ? undefined : `scale(${z})` }
})
// Zoomed out, the picture is smaller than the card: a soft blurred copy fills the rest, so no raw empty space.
const zoomedOut = computed(() => props.fit === 'cover' && (props.zoom ?? 100) < 100)
const initial = computed(() => (props.name.trim()[0] ?? '?').toUpperCase())
</script>

<template>
  <span class="pic" :class="fit ?? 'contain'">
    <img v-if="src && !failed && zoomedOut" class="back" :src="src" alt="" aria-hidden="true" decoding="async" draggable="false" referrerpolicy="no-referrer">
    <img
      v-if="src && !failed"
      :src="src"
      :style="imgStyle"
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
.pic .back { position: absolute; inset: 0; object-fit: cover; transform: scale(1.25); filter: blur(14px) saturate(1.1); opacity: .85; pointer-events: none; }
.ph { font-size: 44px; font-weight: 800; color: var(--g-ink, var(--vv-goal)); opacity: .9; }
</style>
