<script setup lang="ts">
import { Trash2 } from 'lucide-vue-next'
import { useCategoriesStore, type Category, type CategoryKind } from '~/stores/categories'

/**
 * Create or edit a category, in a bottom sheet:
 *   live preview (tile + name) · name · type · colour · icon · save (· delete)
 *
 * `category` = null  -> new; an object -> edit that one.
 * Deleting keeps every transaction: the relation is SetNull, they just
 * become "not sorted yet" - financial history is never destroyed.
 */
const props = defineProps<{ open: boolean; category: Category | null; defaultKind?: CategoryKind }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const { toast } = useToast()
const store = useCategoriesStore()

const TINTS = Array.from({ length: 12 }, (_, i) => `cat-${i + 1}`)

const name = ref('')
const kind = ref<CategoryKind>('EXPENSE')
const color = ref('cat-1')
const icon = ref('package')
const error = ref('')
const saving = ref(false)

// Fresh values every time it opens: the category's own, or new defaults.
watch(() => props.open, (isOpen) => {
  if (!isOpen) return
  const c = props.category
  name.value = c?.name ?? ''
  kind.value = c?.kind ?? props.defaultKind ?? 'EXPENSE'
  color.value = c?.color ?? 'cat-1'
  icon.value = c?.icon ?? 'package'
  error.value = ''
})

const open = computed({
  get: () => props.open,
  set: (v: boolean) => { if (!v) emit('close') },
})

async function save() {
  if (saving.value) return
  if (!name.value.trim()) { error.value = t('cats.nameRequired'); return }
  error.value = ''
  saving.value = true
  const input = { name: name.value.trim(), kind: kind.value, icon: icon.value, color: color.value }
  const ok = props.category ? await store.update(props.category.id, input) : await store.create(input)
  saving.value = false
  if (!ok) {
    error.value = store.errorStatus === 409 ? t('cats.duplicate') : t('drawer.couldNotSave')
    return
  }
  toast(props.category ? t('toast.saved') : t('cats.created'))
  emit('close')
}

async function remove() {
  const c = props.category
  if (!c || !confirm(t('cats.deleteConfirm', { name: c.name }))) return
  if (await store.remove(c.id)) {
    toast(t('cats.deleted'))
    emit('close')
  } else {
    error.value = t('drawer.couldNotSave')
  }
}
</script>

<template>
  <UiBottomSheet v-model="open" :title="category ? t('cats.edit') : t('cats.new')">
    <form class="form" @submit.prevent="save">
      <!-- Live preview: what the tile will look like everywhere. -->
      <div class="preview">
        <span class="tile neu" :style="{ background: `var(--vv-${color})`, color: `var(--vv-${color}-fg)` }" aria-hidden="true">
          <CategoryIcon :name="icon" :size="26" />
        </span>
        <strong>{{ name.trim() || t('cats.namePh') }}</strong>
      </div>

      <UiField v-model="name" :label="t('cats.name')" :placeholder="t('cats.namePh')" :maxlength="40" :error="error" />

      <UiSegmented
        v-model="kind"
        :label="t('cats.kind')"
        :options="[
          { value: 'EXPENSE', label: t('cats.EXPENSE') },
          { value: 'INCOME', label: t('cats.INCOME') },
          { value: 'TRANSFER', label: t('cats.TRANSFER') },
        ]"
      />

      <div>
        <p class="label">{{ t('cats.color') }}</p>
        <div class="tints" role="radiogroup" :aria-label="t('cats.color')">
          <button
            v-for="(tint, i) in TINTS"
            :key="tint"
            type="button"
            class="tint"
            :class="{ on: color === tint }"
            role="radio"
            :aria-checked="color === tint"
            :aria-label="t('cats.colorN', { n: i + 1 })"
            :style="{ background: `var(--vv-${tint})` }"
            @click="color = tint"
          />
        </div>
      </div>

      <div>
        <p class="label">{{ t('cats.icon') }}</p>
        <IconPicker v-model="icon" :color="color" />
      </div>

      <UiButton type="submit" :loading="saving">{{ category ? t('cats.save') : t('cats.create') }}</UiButton>
      <UiButton v-if="category" variant="danger" :icon="Trash2" @click="remove">{{ t('cats.delete') }}</UiButton>
    </form>
  </UiBottomSheet>
</template>

<style scoped>
.form { display: grid; gap: 20px; }
.preview { display: flex; align-items: center; gap: 14px; }
.tile { display: grid; place-items: center; width: 56px; height: 56px; flex: none; border-radius: var(--vv-r-sm); }
.preview strong { font-size: 18px; font-weight: 800; overflow-wrap: anywhere; }
.label { margin: 0 0 10px; font-size: 13px; font-weight: 700; color: var(--vv-muted); }
.tints { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; }
.tint {
  aspect-ratio: 1; border: none; border-radius: var(--vv-r-badge); cursor: pointer;
  box-shadow: var(--vv-e1); -webkit-tap-highlight-color: transparent;
}
.tint.on { box-shadow: var(--vv-p1), 0 0 0 3px var(--vv-accent-ring); }
.tint:focus-visible { outline: 2px solid var(--vv-accent-ring); outline-offset: 2px; }
</style>
