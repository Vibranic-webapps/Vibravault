<script setup lang="ts">
const user = useAuthUser()

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  user.value = null
  await navigateTo('/login')
}
</script>

<template>
  <main class="page">
    <div class="neu card">
      <p class="eyebrow">Vibravault</p>
      <h1>Signed in</h1>
      <p class="muted">{{ user?.email }}</p>
      <button class="vv-btn" @click="logout">Log out</button>
    </div>
  </main>
</template>

<style scoped>
.page { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
.card { width: 100%; max-width: 420px; padding: 34px; text-align: center; }
.eyebrow {
  margin: 0 0 6px; font-size: 12px; font-weight: 700; letter-spacing: .14em;
  text-transform: uppercase; color: var(--vv-indigo);
}
h1 { margin: 0 0 6px; font-size: 26px; }
.muted { margin: 0 0 26px; color: var(--vv-muted); font-size: 15px; }
</style>
