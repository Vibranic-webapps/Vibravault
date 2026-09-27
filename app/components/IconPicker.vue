<script setup lang="ts">
import { CATEGORY_ICON_GROUPS } from '~~/shared/utils/categoryIcons'

/**
 * Pick a category icon from the curated Lucide set, shown in its groups
 * (Money, Home, Food & drinks, ...) so 60 icons stay findable. The chosen
 * one is pressed in and wears the category's colour.
 */
const props = defineProps<{ modelValue: string; color: string }>()
const emit = defineEmits<{ 'update:modelValue': [name: string] }>()
const { t } = useI18n()

const groups = Object.entries(CATEGORY_ICON_GROUPS) as [keyof typeof CATEGORY_ICON_GROUPS, readonly string[]][]
const chosenStyle = computed(() => ({ background: `var(--vv-${props.color})`, color: `var(--vv-${props.color}-fg)` }))
</script>

<template>
  <div class="picker">
    <section v-for="[key, names] in groups" :key="key" class="group">
      <h4>{{ t(`iconGroup.${key}`) }}</h4>
      <div class="grid">
        <button
          v-for="name in names"
          :key="name"
          type="button"
          class="ic"
          :class="{ on: modelValue === name }"
          :style="modelValue === name ? chosenStyle : undefined"
          :aria-pressed="modelValue === name"
          :aria-label="name.replace(/-/g, ' ')"
          @click="emit('update:modelValue', name)"
        >
          <CategoryIcon :name="name" :size="19" />
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.group + .group { margin-top: 14px; }
h4 { margin: 0 0 8px; font-size: 12px; font-weight: 700; color: var(--vv-muted); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(44px, 1fr)); gap: 8px; }
.ic {
  display: grid; place-items: center; aspect-ratio: 1; min-height: 44px;
  color: var(--vv-muted); background: var(--vv-surface);
  border: none; border-radius: var(--vv-r-badge); box-shadow: var(--vv-e1); cursor: pointer;
  -webkit-tap-highlight-color: transparent; transition: box-shadow .12s ease;
}
.ic:active { box-shadow: var(--vv-p1); }
.ic.on { box-shadow: var(--vv-p1), 0 0 0 2px var(--vv-accent-ring); }
.ic:focus-visible { outline: 2px solid var(--vv-accent-ring); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .ic { transition: none; } }
</style>
