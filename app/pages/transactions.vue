<script setup lang="ts">
const route = useRoute()
const wantsNew = computed(() => route.query.new === '1')
</script>

<template>
  <div>
    <h1>Transactions</h1>
    <p class="muted">
      {{ wantsNew ? 'Add form lands tomorrow (Sun 6).' : 'List + manual add lands tomorrow (Sun 6).' }}
    </p>
    <div class="neu-3 panel">
      <p class="empty">No transactions yet.</p>
    </div>
  </div>
</template>

<style scoped>
h1 { margin: 0 0 4px; font-size: 26px; }
.muted { margin: 0 0 26px; color: var(--vv-muted); font-size: 14px; }
.panel { padding: 40px 24px; text-align: center; }
.empty { margin: 0; color: var(--vv-muted-2); font-size: 14px; }
</style>
