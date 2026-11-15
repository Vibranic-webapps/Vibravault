<script setup lang="ts">
import { RotateCcw } from 'lucide-vue-next'
import { GOAL_FRAME, DEFAULT_FRAMING, clampFrame, type GoalFraming } from '~/utils/goalLook'

/**
 * Choose which part of a goal's picture shows on its card.
 * A frame in the card's own shape shows the picture exactly as the card will
 * (GoalPicture, `cover`). Drag the frame to move the picture, slide to zoom.
 * Keyboard: arrow keys move, + / - zoom. Reset puts it back to the middle, no zoom.
 *
 * The v-model is the three numbers the server stores (focus % + zoom %).
 * The page's sideways swipe and the sheet's drag-to-close are kept off the frame.
 */
const props = defineProps<{ src: string | null; name: string; modelValue: GoalFraming }>()
const emit = defineEmits<{ 'update:modelValue': [value: GoalFraming] }>()
const { t } = useI18n()

const frameEl = ref<HTMLElement | null>(null)
const broken = ref(false)
watch(() => props.src, () => { broken.value = false })

const KEY_STEP = 2 // % per arrow key press
const ZOOM_KEY_STEP = 10

function set(next: Partial<GoalFraming>) {
  const m = props.modelValue
  emit('update:modelValue', {
    focusX: clampFrame(next.focusX ?? m.focusX, GOAL_FRAME.focusMin, GOAL_FRAME.focusMax),
    focusY: clampFrame(next.focusY ?? m.focusY, GOAL_FRAME.focusMin, GOAL_FRAME.focusMax),
    zoom: clampFrame(next.zoom ?? m.zoom, GOAL_FRAME.zoomMin, GOAL_FRAME.zoomMax),
  })
}

const isDefault = computed(() => {
  const m = props.modelValue
  return m.focusX === DEFAULT_FRAMING.focusX && m.focusY === DEFAULT_FRAMING.focusY && m.zoom === DEFAULT_FRAMING.zoom
})

// ---- Drag to move ----------------------------------------------------------------
/**
 * How far the picture slides per focus unit: with `cover` the image overflows the frame by
 * (rendered size * zoom - frame size), and one focus point moves it 1/100 of that. Dividing the
 * finger's travel by it makes the picture follow the finger 1:1. An axis with no overflow stays put.
 */
function pxPerFocusUnit(frame: number, natural: number, naturalOther: number, frameOther: number, zoom: number) {
  if (!natural || !naturalOther) return Math.max(frame * zoom, 1) / 100 // image size unknown: a sane guess
  const rendered = natural * Math.max(frame / natural, frameOther / naturalOther)
  return Math.max(rendered * zoom - frame, 0) / 100
}

let drag: { id: number; x: number; y: number; fx: number; fy: number; sx: number; sy: number } | null = null
const dragging = ref(false)

function onPointerDown(e: PointerEvent) {
  const el = frameEl.value
  if (!el || (e.pointerType === 'mouse' && e.button !== 0)) return
  const rect = el.getBoundingClientRect()
  const img = el.querySelector('img')
  const nw = img?.naturalWidth ?? 0
  const nh = img?.naturalHeight ?? 0
  const z = props.modelValue.zoom / 100
  drag = {
    id: e.pointerId, x: e.clientX, y: e.clientY,
    fx: props.modelValue.focusX, fy: props.modelValue.focusY,
    sx: pxPerFocusUnit(rect.width, nw, nh, rect.height, z),
    sy: pxPerFocusUnit(rect.height, nh, nw, rect.width, z),
  }
  el.setPointerCapture(e.pointerId)
  dragging.value = true
}

function onPointerMove(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.id) return
  const dx = e.clientX - drag.x
  const dy = e.clientY - drag.y
  // Dragging right pulls the picture right, so we see more of its left: the focus point goes down.
  set({
    focusX: drag.sx >= 0.5 ? drag.fx - dx / drag.sx : drag.fx,
    focusY: drag.sy >= 0.5 ? drag.fy - dy / drag.sy : drag.fy,
  })
}

function onPointerEnd(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.id) return
  drag = null
  dragging.value = false
}

// ---- Keyboard ----------------------------------------------------------------------
function onKey(e: KeyboardEvent) {
  const m = props.modelValue
  const moves: Record<string, Partial<GoalFraming>> = {
    ArrowLeft: { focusX: m.focusX - KEY_STEP },
    ArrowRight: { focusX: m.focusX + KEY_STEP },
    ArrowUp: { focusY: m.focusY - KEY_STEP },
    ArrowDown: { focusY: m.focusY + KEY_STEP },
    '+': { zoom: m.zoom + ZOOM_KEY_STEP },
    '=': { zoom: m.zoom + ZOOM_KEY_STEP },
    '-': { zoom: m.zoom - ZOOM_KEY_STEP },
  }
  const next = moves[e.key]
  if (!next) return
  e.preventDefault()
  set(next)
}

function onZoomInput(e: Event) {
  set({ zoom: Number((e.target as HTMLInputElement).value) })
}

// Same shape as the Home card (constants in goalLook), so the crop you see is the crop you get.
const frameStyle = {
  maxWidth: `${GOAL_FRAME.cardWidth}px`,
  aspectRatio: `${GOAL_FRAME.cardWidth} / ${GOAL_FRAME.cardHeight}`,
}

const sliderId = useId()
const hintId = useId()
</script>

<template>
  <div v-if="src && !broken" class="editor">
    <!-- touch-action: none + data-swipe-lock + stopped touch events: the finger moves the picture,
         not the page (screen swipe) or the sheet (drag to close). -->
    <div
      ref="frameEl"
      class="frame"
      :class="{ dragging }"
      :style="frameStyle"
      role="group"
      tabindex="0"
      data-swipe-lock
      :aria-label="t('goals.frame.label')"
      :aria-describedby="hintId"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerEnd"
      @pointercancel="onPointerEnd"
      @touchstart.stop
      @touchmove.stop
      @keydown="onKey"
    >
      <GoalPicture
        :src="src"
        :name="name"
        fit="cover"
        :focus-x="modelValue.focusX"
        :focus-y="modelValue.focusY"
        :zoom="modelValue.zoom"
        @broken="broken = true"
      />
    </div>
    <p :id="hintId" class="hint">{{ t('goals.frame.hint') }}</p>

    <div class="zoom">
      <label :for="sliderId" class="zoom-label">{{ t('goals.frame.zoom') }}</label>
      <input
        :id="sliderId"
        class="range"
        type="range"
        :min="GOAL_FRAME.zoomMin"
        :max="GOAL_FRAME.zoomMax"
        step="1"
        :value="modelValue.zoom"
        :aria-valuetext="`${modelValue.zoom}%`"
        @input="onZoomInput"
      >
      <span class="zoom-value" aria-hidden="true">{{ modelValue.zoom }}%</span>
    </div>

    <UiButton variant="ghost" :block="false" :icon="RotateCcw" :disabled="isDefault" @click="set({ ...DEFAULT_FRAMING })">
      {{ t('goals.frame.reset') }}
    </UiButton>
  </div>
</template>

<style scoped>
.editor { display: grid; gap: 12px; justify-items: start; min-width: 0; max-width: 100%; }

.frame {
  position: relative;
  width: 100%;
  background: var(--g-bg);
  border-radius: var(--vv-r-md);
  box-shadow: var(--vv-p1);
  overflow: hidden;
  touch-action: none;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.frame.dragging { cursor: grabbing; }
.frame:focus-visible { outline: 2px solid var(--vv-accent-ring); outline-offset: 3px; }

.hint { margin: 0; font-size: 13px; color: var(--vv-muted); }

.zoom { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 44px; }
.zoom-label { flex: none; font-size: 14px; font-weight: 700; color: var(--vv-text); }
.zoom-value { flex: none; min-width: 3.5ch; text-align: right; font-size: 14px; color: var(--vv-muted); font-variant-numeric: tabular-nums; }
.range { flex: 1; min-width: 0; height: 44px; margin: 0; accent-color: var(--vv-accent); cursor: pointer; }
.range:focus-visible { outline: 2px solid var(--vv-accent-ring); outline-offset: 2px; border-radius: var(--vv-r-sm); }
</style>
