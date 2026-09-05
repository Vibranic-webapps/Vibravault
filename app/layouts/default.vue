<script setup lang="ts">
// App shell for authenticated pages: header + floating soft-UI nav bar.
const user = useAuthUser()
const theme = useTheme()

const navItems = [
  { to: '/',             label: 'Dashboard',    icon: '◧' },
  { to: '/transactions', label: 'Transactions', icon: '≡' },
  { to: '/categories',   label: 'Categories',   icon: '◎' },
] as const

const nextTheme = computed(() => (theme.value === 'dark' ? 'light' : 'dark'))

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  user.value = null
  await navigateTo('/login')
}
</script>

<template>
  <div class="shell">
    <header class="shell-head">
      <NuxtLink to="/" class="brand">Vibravault</NuxtLink>

      <div class="head-actions">
        <button
          class="icon-btn"
          type="button"
          :aria-label="`Switch to ${nextTheme} mode`"
          @click="theme = nextTheme"
        >{{ theme === 'dark' ? '☀' : '☾' }}</button>
        <button class="icon-btn" type="button" aria-label="Log out" @click="logout">⏻</button>
      </div>
    </header>

    <main class="shell-main">
      <slot />
    </main>

    <!-- Floating nav bar. Bottom + thumb-reachable on mobile. Items are BADGES
         (rounded rectangles), not pills - decided 2026-09-05. -->
    <nav class="navbar" aria-label="Main">
      <NuxtLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="nav-item"
        active-class="active"
      >
        <span class="nav-icon" aria-hidden="true">{{ item.icon }}</span>
        <span class="nav-label">{{ item.label }}</span>
      </NuxtLink>

      <NuxtLink to="/transactions?new=1" class="nav-add" aria-label="Add transaction">+</NuxtLink>
    </nav>
  </div>
</template>

<style scoped>
.shell { min-height: 100vh; padding-bottom: 108px; }

.shell-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; padding: 22px 24px 8px;
  max-width: 900px; margin: 0 auto;
}
.brand {
  font-size: 13px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase;
  color: var(--vv-brand); text-decoration: none;
}
.head-actions { display: flex; gap: 10px; }
.icon-btn {
  width: 38px; height: 38px; display: grid; place-items: center;
  font: inherit; font-size: 15px; line-height: 1;
  color: var(--vv-muted); background: var(--vv-surface);
  border: none; border-radius: var(--vv-r-badge);
  box-shadow: var(--vv-e1); cursor: pointer;
  transition: box-shadow .12s ease, color .12s ease;
}
.icon-btn:hover { color: var(--vv-text); }
.icon-btn:active { box-shadow: var(--vv-p1); }

.shell-main { max-width: 900px; margin: 0 auto; padding: 8px 24px 24px; }

.navbar {
  position: fixed; left: 50%; bottom: 22px; transform: translateX(-50%);
  z-index: 20;
  display: flex; align-items: center; gap: 6px;
  padding: 8px; border-radius: var(--vv-r-md);
  background: var(--vv-surface); box-shadow: var(--vv-e2);
}
.nav-item {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 16px; border-radius: var(--vv-r-badge);
  font-size: 13px; font-weight: 600; text-decoration: none;
  color: var(--vv-muted); white-space: nowrap;
  transition: color .12s ease, box-shadow .12s ease;
}
.nav-item:hover { color: var(--vv-text); }
/* Active = pressed IN. Same inversion the whole system runs on. */
.nav-item.active { color: var(--vv-accent); box-shadow: var(--vv-p1); }
.nav-icon { font-size: 15px; line-height: 1; }

.nav-add {
  width: 42px; height: 42px; margin-left: 4px;
  display: grid; place-items: center;
  font-size: 22px; line-height: 1; font-weight: 500; text-decoration: none;
  color: var(--vv-accent-text); background: var(--vv-accent);
  border-radius: var(--vv-r-badge); box-shadow: var(--vv-e1);
  transition: transform .12s ease, box-shadow .12s ease;
}
.nav-add:hover { transform: translateY(-1px); }
.nav-add:active { transform: translateY(1px); box-shadow: var(--vv-p1); }

/* Labels collapse on small screens; icons + the add button stay thumb-reachable. */
@media (max-width: 560px) {
  .nav-label { display: none; }
  .nav-item { padding: 11px 15px; }
  .shell-head { padding: 18px 18px 6px; }
  .shell-main { padding: 8px 18px 24px; }
}
</style>
