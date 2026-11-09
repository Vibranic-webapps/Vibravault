<script setup lang="ts">
/**
 * "Are you sure?" in the app's own look, replacing the browser's confirm().
 * Built on UiBottomSheet, so it gets the same focus trap, inert background,
 * Escape handling and focus return for free.
 *
 * There is no header (so no X button): the first focusable element is Cancel,
 * which means Cancel is what has focus on open. That is the safe default for
 * a destructive action - a stray Enter cancels instead of deleting.
 */
interface Props {
  open: boolean
  title: string
  body?: string
  confirmLabel: string
  cancelLabel: string
  /** Red confirm button for things that can't be undone. */
  destructive?: boolean
  /** Confirm is running (e.g. the request is in flight). */
  loading?: boolean
}
const props = withDefaults(defineProps<Props>(), { destructive: false, loading: false })
const emit = defineEmits<{ confirm: []; cancel: [] }>()

const model = computed({
  get: () => props.open,
  set: (v: boolean) => { if (!v) emit('cancel') },
})
</script>

<template>
  <UiBottomSheet v-model="model" :label="title">
    <div class="dialog">
      <h2>{{ title }}</h2>
      <p v-if="body">{{ body }}</p>
      <div class="actions">
        <UiButton variant="ghost" :disabled="loading" @click="emit('cancel')">{{ cancelLabel }}</UiButton>
        <UiButton :variant="destructive ? 'danger' : 'primary'" :loading="loading" @click="emit('confirm')">{{ confirmLabel }}</UiButton>
      </div>
    </div>
  </UiBottomSheet>
</template>

<style scoped>
.dialog { display: grid; gap: 12px; padding-top: 6px; }
h2 { margin: 0; font-size: 19px; font-weight: 800; }
p { margin: 0; font-size: 15px; line-height: 1.5; color: var(--vv-muted); overflow-wrap: anywhere; }
.actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px; }
</style>
