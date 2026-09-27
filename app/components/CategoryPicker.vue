<script setup lang="ts">
import { CircleDashed } from 'lucide-vue-next'
import { useCategoriesStore } from '~/stores/categories'

/**
 * Categories as TILES, not a dropdown: big targets, each in its own colour,
 * one tap to choose. Used by the transaction drawer and the Add form.
 *
 * Shows the categories that fit the money's direction (spending for money
 * out, income for money in), then transfers - which go either way - then
 * "not sorted yet".
 *
 * `modelValue` is the chosen category id (null = not sorted). The picker only
 * DISPLAYS the choice; the parent decides what a tap means (save now, or
 * remember it until the form is saved).
 */
const props = withDefaults(defineProps<{
  modelValue: string | null
  direction: 'in' | 'out'
  disabled?: boolean
}>(), { disabled: false })
const emit = defineEmits<{ 'update:modelValue': [id: string | null] }>()

const { t } = useI18n()
const categories = useCategoriesStore()

const groups = computed(() => [
  props.direction === 'in'
    ? { key: 'income', title: t('drawer.groupIncome'), items: categories.income }
    : { key: 'spending', title: t('drawer.groupSpending'), items: categories.expense },
  { key: 'transfer', title: t('drawer.groupTransfer'), items: categories.transfer },
].filter((g) => g.items.length))

function tint(c: { color: string }) {
  return { background: `var(--vv-${c.color})`, color: `var(--vv-${c.color}-fg)` }
}
</script>

<template>
  <div class="picker">
    <section v-for="g in groups" :key="g.key" class="group">
      <h3>{{ g.title }}</h3>
      <div class="tiles">
        <button
          v-for="c in g.items"
          :key="c.id"
          type="button"
          class="cat-tile"
          :class="{ on: modelValue === c.id }"
          :aria-pressed="modelValue === c.id"
          :disabled="disabled"
          @click="emit('update:modelValue', c.id)"
        >
          <span class="ct-icon neu" :style="tint(c)" aria-hidden="true">{{ c.icon }}</span>
          <span class="ct-name">{{ c.name }}</span>
        </button>
      </div>
    </section>

    <section class="group">
      <div class="tiles">
        <button
          type="button"
          class="cat-tile"
          :class="{ on: modelValue === null }"
          :aria-pressed="modelValue === null"
          :disabled="disabled"
          @click="emit('update:modelValue', null)"
        >
          <span class="ct-icon neu" aria-hidden="true"><CircleDashed :size="20" /></span>
          <span class="ct-name">{{ t('home.unsorted') }}</span>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.group + .group { margin-top: 18px; }
.group h3 { margin: 0 0 10px; font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--vv-muted); }
.tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 10px; }
.cat-tile {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 12px 6px; min-height: 96px;
  font: inherit; color: var(--vv-text); background: var(--vv-surface);
  border: none; border-radius: var(--vv-r-sm); box-shadow: var(--vv-e1); cursor: pointer;
  -webkit-tap-highlight-color: transparent; transition: box-shadow .12s ease;
}
/* The chosen category is pressed in with an accent ring - only ever one. */
.cat-tile.on { box-shadow: var(--vv-p1), 0 0 0 2px var(--vv-accent-ring); }
.cat-tile:active { box-shadow: var(--vv-p1); }
.cat-tile:disabled { cursor: progress; }
.cat-tile:focus-visible { outline: 2px solid var(--vv-accent-ring); outline-offset: 2px; }
.ct-icon { display: grid; place-items: center; width: 42px; height: 42px; font-size: 19px; color: var(--vv-muted); border-radius: var(--vv-r-sm); }
.ct-name { font-size: 12px; font-weight: 600; text-align: center; line-height: 1.25; overflow-wrap: anywhere; }
@media (prefers-reduced-motion: reduce) { .cat-tile { transition: none; } }
</style>
