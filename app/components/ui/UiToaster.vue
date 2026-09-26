<script setup lang="ts">
import { CircleCheck, CircleAlert } from 'lucide-vue-next'

/** Renders the toasts raised through useToast(). Place once, in the layout. */
const { toasts, dismiss } = useToast()
</script>

<template>
  <div class="toaster" role="status" aria-live="polite">
    <TransitionGroup name="toast">
      <button
        v-for="t in toasts"
        :key="t.id"
        type="button"
        class="neu-2 toast"
        :class="t.tone"
        @click="dismiss(t.id)"
      >
        <CircleAlert v-if="t.tone === 'bad'" :size="18" aria-hidden="true" />
        <CircleCheck v-else-if="t.tone === 'good'" :size="18" aria-hidden="true" />
        <span>{{ t.message }}</span>
      </button>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toaster {
  position: fixed; left: 50%; transform: translateX(-50%); z-index: 70;
  top: calc(14px + env(safe-area-inset-top));
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  width: min(92vw, 420px); pointer-events: none;
}
.toast {
  pointer-events: auto; display: flex; align-items: center; gap: 10px;
  padding: 12px 16px; border: none; border-radius: var(--vv-r-sm);
  font: inherit; font-size: 14px; font-weight: 600; color: var(--vv-text); cursor: pointer;
}
.toast.good svg { color: var(--vv-accent); }
.toast.bad { color: var(--vv-negative); }
.toast-enter-active, .toast-leave-active { transition: opacity .2s ease, transform .2s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
