<script setup lang="ts">
import { ImagePlus, Trash2, RotateCcw, Plus, Minus } from 'lucide-vue-next'
import {
  GOAL_FRAME, DEFAULT_FRAMING, clampFrame, sliderToZoom, zoomToSlider, type GoalFraming,
} from '~/utils/goalLook'

/**
 * The goal's picture, big, exactly as the Home card will crop it. This is the only picture
 * control in the goal form:
 *   - drag the picture to move it (pointer events, so mouse, finger and pen all work)
 *   - the vertical bar on the right zooms: top = zoom in, bottom = zoom out, and the default
 *     (no zoom) sits at 75 on the bar. Zoom runs 50% to 400%.
 *   - round buttons on the picture: change it (top left) and remove it (top right)
 * Keyboard: arrows move, + / - zoom (on the picture), arrows / Home / End on the bar.
 *
 * The v-model is the three numbers the server stores (focus % + zoom %).
 * The page's sideways swipe and the sheet's drag-to-close are kept off the picture and the bar.
 */
const props = defineProps<{ src: string | null; name: string; modelValue: GoalFraming }>()
const emit = defineEmits<{ 'update:modelValue': [value: GoalFraming]; pick: []; remove: [] }>()
const { t } = useI18n()

const frameEl = ref<HTMLElement | null>(null)
const broken = ref(false)
watch(() => props.src, () => { broken.value = false })
const hasPicture = computed(() => !!props.src && !broken.value)

const KEY_STEP = 2 // % per arrow key press
const ZOOM_KEY_STEP = 10
const SNAP = 2 // the bar snaps to "no zoom" when released this close to it

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

// ---- Drag the picture ------------------------------------------------------------
/**
 * Where the picture's edge sits along one axis is  focus% * (frame - rendered * zoom)  (a `cover`
 * picture, scaled from the focus point). So one focus point moves it (frame - rendered * zoom) / 100
 * px: negative when the picture is bigger than the frame, positive when zoomed out. Dividing the
 * finger's travel by that makes the picture follow the finger 1:1. An axis with no room to move
 * (the picture exactly fits it) stays put.
 */
function pxPerFocusUnit(frame: number, natural: number, naturalOther: number, frameOther: number, zoom: number) {
  // Image size unknown (not decoded yet): assume it overflows a little, so a drag still does something.
  const rendered = natural && naturalOther ? natural * Math.max(frame / natural, frameOther / naturalOther) : frame * 1.25
  return (frame - rendered * zoom) / 100
}

let drag: { id: number; x: number; y: number; fx: number; fy: number; sx: number; sy: number } | null = null
const dragging = ref(false)

function onPointerDown(e: PointerEvent) {
  const el = frameEl.value
  if (!el || !hasPicture.value || (e.pointerType === 'mouse' && e.button !== 0)) return
  const rect = el.getBoundingClientRect()
  const img = el.querySelector<HTMLImageElement>('img:not(.back)')
  const nw = img?.naturalWidth ?? 0
  const nh = img?.naturalHeight ?? 0
  const z = props.modelValue.zoom / 100
  drag = {
    id: e.pointerId, x: e.clientX, y: e.clientY,
    fx: props.modelValue.focusX, fy: props.modelValue.focusY,
    sx: pxPerFocusUnit(rect.width, nw, nh, rect.height, z),
    sy: pxPerFocusUnit(rect.height, nh, nw, rect.width, z),
  }
  try { el.setPointerCapture(e.pointerId) } catch { /* the pointer is already gone */ }
  dragging.value = true
}

function onPointerMove(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.id) return
  const dx = e.clientX - drag.x
  const dy = e.clientY - drag.y
  set({
    focusX: Math.abs(drag.sx) >= 0.3 ? drag.fx + dx / drag.sx : drag.fx,
    focusY: Math.abs(drag.sy) >= 0.3 ? drag.fy + dy / drag.sy : drag.fy,
  })
}

function onPointerEnd(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.id) return
  drag = null
  dragging.value = false
}

// ---- Keyboard on the picture ---------------------------------------------------------
function onKey(e: KeyboardEvent) {
  if (!hasPicture.value) return
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

// ---- The vertical zoom bar ---------------------------------------------------------
// A custom bar, not <input type=range>: a vertical native range is not reliable across phones.
const barEl = ref<HTMLElement | null>(null)
const THUMB = 28
const pos = computed(() => zoomToSlider(props.modelValue.zoom)) // 0 (top) .. 100 (bottom)
let sliding = -1

function setFromPointer(e: PointerEvent, release = false) {
  const el = barEl.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const travel = Math.max(r.height - THUMB, 1)
  let v = ((e.clientY - r.top - THUMB / 2) / travel) * 100
  v = Math.min(100, Math.max(0, v))
  if (release && Math.abs(v - GOAL_FRAME.sliderDefault) <= SNAP) v = GOAL_FRAME.sliderDefault
  set({ zoom: sliderToZoom(v) })
}
function onBarDown(e: PointerEvent) {
  if (!hasPicture.value || (e.pointerType === 'mouse' && e.button !== 0)) return
  sliding = e.pointerId
  try { barEl.value?.setPointerCapture(e.pointerId) } catch { /* gone */ }
  setFromPointer(e)
}
function onBarMove(e: PointerEvent) {
  if (e.pointerId === sliding) setFromPointer(e)
}
function onBarUp(e: PointerEvent) {
  if (e.pointerId !== sliding) return
  setFromPointer(e, true)
  sliding = -1
}
function onBarKey(e: KeyboardEvent) {
  const v = pos.value
  const to: Record<string, number> = {
    ArrowUp: v - 5, ArrowLeft: v - 5, ArrowDown: v + 5, ArrowRight: v + 5,
    PageUp: v - 20, PageDown: v + 20, Home: 0, End: 100,
  }
  if (!(e.key in to)) return
  e.preventDefault()
  set({ zoom: sliderToZoom(to[e.key]!) })
}

const zoomLabel = computed(() => `${(props.modelValue.zoom / 100).toFixed(1)}×`)
const thumbTop = computed(() => `calc((100% - ${THUMB}px) * ${pos.value / 100})`)
const defaultTop = computed(() => `calc((100% - ${THUMB}px) * ${GOAL_FRAME.sliderDefault / 100} + ${THUMB / 2}px)`)

// Same shape as the Home card (constants in goalLook), so the crop you see is the crop you get.
const frameStyle = { aspectRatio: `${GOAL_FRAME.cardWidth} / ${GOAL_FRAME.cardHeight}` }
const hintId = useId()
</script>

<template>
  <div class="editor">
    <div class="stage">
      <!-- touch-action: none + data-swipe-lock + stopped touch events: the finger moves the picture,
           not the page (screen swipe) or the sheet (drag to close). -->
      <div
        ref="frameEl"
        class="frame"
        :class="{ dragging, empty: !hasPicture }"
        :style="frameStyle"
        role="group"
        :tabindex="hasPicture ? 0 : -1"
        data-swipe-lock
        :aria-label="t('goals.frame.label')"
        :aria-describedby="hintId"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerEnd"
        @pointercancel="onPointerEnd"
        @lostpointercapture="onPointerEnd"
        @touchstart.stop
        @touchmove.stop
        @dragstart.prevent
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

        <!-- Round buttons ride on the picture: change top left, remove top right. They must not start a drag. -->
        <button
          v-if="hasPicture"
          type="button"
          class="fab left"
          :aria-label="t('goals.imageChange')"
          @pointerdown.stop
          @click="emit('pick')"
        >
          <ImagePlus :size="20" aria-hidden="true" />
        </button>
        <button
          v-if="src"
          type="button"
          class="fab right"
          :aria-label="t('goals.imageRemove')"
          @pointerdown.stop
          @click="emit('remove')"
        >
          <Trash2 :size="20" aria-hidden="true" />
        </button>
        <button v-if="!hasPicture" type="button" class="add" @pointerdown.stop @click="emit('pick')">
          <ImagePlus :size="20" aria-hidden="true" />
          <span>{{ t('goals.frame.empty') }}</span>
        </button>
      </div>

      <div class="side">
        <span class="value" aria-hidden="true">{{ zoomLabel }}</span>
        <Plus :size="16" class="end" aria-hidden="true" />
        <div
          ref="barEl"
          class="bar"
          :class="{ off: !hasPicture }"
          role="slider"
          :tabindex="hasPicture ? 0 : -1"
          data-swipe-lock
          aria-orientation="vertical"
          :aria-label="t('goals.frame.zoom')"
          :aria-valuemin="0"
          :aria-valuemax="100"
          :aria-valuenow="Math.round(pos)"
          :aria-valuetext="zoomLabel"
          :aria-disabled="!hasPicture"
          @pointerdown="onBarDown"
          @pointermove="onBarMove"
          @pointerup="onBarUp"
          @pointercancel="onBarUp"
          @touchstart.stop
          @touchmove.stop
          @keydown="onBarKey"
        >
          <span class="rail" />
          <span class="tick" :style="{ top: defaultTop }" />
          <span class="thumb" :style="{ top: thumbTop }" />
        </div>
        <Minus :size="16" class="end" aria-hidden="true" />
        <button
          type="button"
          class="reset"
          :aria-label="t('goals.frame.reset')"
          :disabled="isDefault || !hasPicture"
          @click="set({ ...DEFAULT_FRAMING })"
        >
          <RotateCcw :size="16" aria-hidden="true" />
        </button>
      </div>
    </div>
    <p v-if="hasPicture" :id="hintId" class="hint">{{ t('goals.frame.hint') }}</p>
    <span v-else :id="hintId" class="sr-only">{{ t('goals.frame.empty') }}</span>
  </div>
</template>

<style scoped>
.editor { display: grid; gap: 10px; min-width: 0; }
.stage { display: grid; grid-template-columns: minmax(0, 1fr) 44px; gap: 12px; justify-content: center; max-width: 380px; width: 100%; margin: 0 auto; }

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
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
}
.frame.empty { cursor: default; }
.frame.dragging { cursor: grabbing; }
.frame:focus-visible { outline: 2px solid var(--vv-accent-ring); outline-offset: 3px; }
/* The finger always lands on the frame itself, never on the image (which would start a native drag). */
.frame :deep(img) { pointer-events: none; }

/* Round buttons on the picture: raised discs, the same family as the goal card's ring badge. */
.fab {
  position: absolute; top: 10px; z-index: 2;
  display: grid; place-items: center; width: 44px; height: 44px; padding: 0;
  color: var(--vv-text); background: var(--vv-surface); border: none; border-radius: 50%;
  box-shadow: var(--vv-e1); cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.fab.left { left: 10px; }
.fab.right { right: 10px; }
.fab:active { box-shadow: var(--vv-p2); }
.fab:focus-visible, .add:focus-visible, .reset:focus-visible { outline: 2px solid var(--vv-accent-ring); outline-offset: 2px; }

.add {
  position: absolute; left: 50%; bottom: 14%; z-index: 2; transform: translateX(-50%);
  display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 16px;
  font: inherit; font-size: 14px; font-weight: 700; white-space: nowrap;
  color: var(--vv-text); background: var(--vv-surface); border: none; border-radius: 999px;
  box-shadow: var(--vv-e1); cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.add:active { box-shadow: var(--vv-p2); }

/* Zoom bar: + at the top (zoom in), - at the bottom (zoom out), a tick where "no zoom" is. */
.side { display: flex; flex-direction: column; align-items: center; gap: 6px; min-height: 0; color: var(--vv-muted); }
.value { font-size: 13px; font-weight: 700; color: var(--vv-text); font-variant-numeric: tabular-nums; }
.end { flex: none; }
.bar {
  position: relative; flex: 1; width: 44px; min-height: 120px;
  touch-action: none; cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.bar.off { opacity: .45; cursor: default; }
.bar:focus-visible { outline: 2px solid var(--vv-accent-ring); outline-offset: 2px; border-radius: var(--vv-r-sm); }
.rail {
  position: absolute; top: 14px; bottom: 14px; left: 50%; width: 8px; transform: translateX(-50%);
  border-radius: 999px; box-shadow: var(--vv-p1);
}
.tick { position: absolute; left: 50%; width: 18px; height: 2px; margin-top: -1px; transform: translateX(-50%); border-radius: 1px; background: var(--vv-muted); opacity: .6; pointer-events: none; }
.thumb {
  position: absolute; left: 50%; width: 28px; height: 28px; margin-left: -14px;
  border-radius: 50%; background: var(--vv-surface); box-shadow: var(--vv-e1); pointer-events: none;
}
.bar:active .thumb { box-shadow: var(--vv-p2); }
.reset {
  display: grid; place-items: center; flex: none; width: 36px; height: 36px; padding: 0;
  color: var(--vv-text); background: var(--vv-surface); border: none; border-radius: 50%;
  box-shadow: var(--vv-e1); cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.reset:disabled { opacity: .45; cursor: default; box-shadow: none; }

.hint { margin: 0; font-size: 13px; text-align: center; color: var(--vv-muted); }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
