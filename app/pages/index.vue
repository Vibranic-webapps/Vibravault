<script setup lang="ts">
const user = useAuthUser()
</script>

<template>
  <div>
    <h1>Dashboard</h1>
    <p class="muted">Signed in as {{ user?.email }}</p>

    <div class="neu-4 hero">
      <p class="hero-label">Balance</p>
      <p class="hero-value">€0,00</p>
      <p class="hero-note">Coming Mon–Tue: balance, income/expense tiles, and a monthly frame with the weeks inside it.</p>
    </div>
  </div>
</template>

<style scoped>
h1 { margin: 0 0 4px; font-size: 26px; }
.muted { margin: 0 0 26px; color: var(--vv-muted); font-size: 14px; }
.hero { padding: 30px; text-align: center; }
.hero-label { margin: 0 0 6px; font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--vv-muted); }
.hero-value { margin: 0 0 10px; font-size: 40px; font-weight: 700; font-variant-numeric: tabular-nums; }
.hero-note { margin: 0; color: var(--vv-muted-2); font-size: 13px; }
</style>
