<script setup lang="ts">
// Living style guide. Sits behind the global auth middleware like every other
// non-public page, so it is not exposed publicly.
const themes = useTheme()

const elevations = [
  { cls: 'neu',   name: 'e1', use: 'chips, ticks, small tiles', spec: '3px / blur 6' },
  { cls: 'neu-2', name: 'e2', use: 'buttons, fields, nav pill', spec: '6px / blur 12' },
  { cls: 'neu-3', name: 'e3', use: 'cards, panels', spec: '12px / blur 24' },
  { cls: 'neu-4', name: 'e4', use: 'hero / balance widget', spec: '18px / blur 30 (reference spec)' },
]

const pressed = [
  { cls: 'neu-pressed',   name: 'p1', use: 'toggles, small wells' },
  { cls: 'neu-pressed-2', name: 'p2', use: 'inputs, meter tracks' },
  { cls: 'neu-pressed-3', name: 'p3', use: 'large inset panels' },
]

const swatches = [
  { token: '--vv-surface',      label: 'Surface / background' },
  { token: '--vv-shadow-light', label: 'Shadow light (top-left)' },
  { token: '--vv-shadow-dark',  label: 'Shadow dark (bottom-right)' },
  { token: '--vv-accent',       label: 'Accent (income, actions)' },
  { token: '--vv-negative',     label: 'Negative (expenses, errors)' },
  { token: '--vv-brand',        label: 'Brand (Vibranic family)' },
]

const rows = [
  { icon: '🛒', name: 'Colruyt',     cat: 'Groceries · 4 Sep',  amount: '−€42,18', cls: 'vv-amount-out' },
  { icon: '💼', name: 'Accent Jobs', cat: 'Wage · 3 Sep',       amount: '+€412,60', cls: 'vv-amount-in' },
  { icon: '🏠', name: 'Rent',        cat: 'Housing · 1 Sep',    amount: '−€680,00', cls: 'vv-amount-out' },
]
</script>

<template>
  <main class="page">
    <header class="head">
      <div>
        <p class="eyebrow">Vibravault</p>
        <h1>Design system</h1>
        <p class="muted">Neumorphism — surfaces are extruded from the background, never placed on it.</p>
      </div>
      <div class="themes">
        <button
          v-for="theme in (['system', 'light', 'dark'] as const)"
          :key="theme"
          class="chip"
          :class="{ active: themes === theme }"
          @click="themes = theme"
        >{{ theme }}</button>
      </div>
    </header>

    <section>
      <h2>Elevation — raised</h2>
      <p class="note">Offset and blur scale with element size. One shadow size everywhere is how neumorphism goes wrong.</p>
      <div class="grid">
        <div v-for="e in elevations" :key="e.name" class="demo">
          <div class="tile" :class="e.cls" />
          <p class="t-name">{{ e.name }}</p>
          <p class="t-use">{{ e.use }}</p>
          <p class="t-spec">{{ e.spec }}</p>
        </div>
      </div>
    </section>

    <section>
      <h2>Elevation — pressed</h2>
      <p class="note">The same shadows inverted inward. That single inversion is the entire language.</p>
      <div class="grid">
        <div v-for="p in pressed" :key="p.name" class="demo">
          <div class="tile" :class="p.cls" />
          <p class="t-name">{{ p.name }}</p>
          <p class="t-use">{{ p.use }}</p>
        </div>
      </div>
    </section>

    <section>
      <h2>Colour</h2>
      <div class="grid">
        <div v-for="s in swatches" :key="s.token" class="demo">
          <div class="tile neu-2 swatch" :style="{ background: `var(${s.token})` }" />
          <p class="t-name">{{ s.label }}</p>
          <p class="t-spec">{{ s.token }}</p>
        </div>
      </div>
    </section>

    <section>
      <h2>Controls</h2>
      <div class="neu-3 panel">
        <label class="vv-label" for="d1">Field (pressed in = type here)</label>
        <input id="d1" class="vv-field" placeholder="Search transactions" />

        <label class="vv-label spaced" for="d2">Field, invalid</label>
        <input id="d2" class="vv-field vv-field--error" placeholder="Something is wrong" />

        <p class="vv-error spaced">Coral carries one meaning: negative or wrong.</p>

        <button class="vv-btn spaced">Primary — press to invert the shadow</button>
        <button class="vv-btn vv-btn--ghost spaced">Ghost — pure surface, pure neumorphism</button>
      </div>
    </section>

    <section>
      <h2>Data-dense: FLAT, not raised</h2>
      <p class="note">
        Transaction rows never get shadows. Extruded rows read as corrugated cardboard, and
        low-contrast soft shadows mush together at small sizes.
      </p>
      <div class="neu-3 panel">
        <div v-for="(r, i) in rows" :key="r.name" class="row" :class="{ 'neu-divider': i < rows.length - 1 }">
          <span class="icon neu">{{ r.icon }}</span>
          <span class="row-main">
            <strong>{{ r.name }}</strong>
            <small>{{ r.cat }}</small>
          </span>
          <span :class="r.cls">{{ r.amount }}</span>
        </div>
      </div>
    </section>

    <p class="foot"><NuxtLink class="vv-link" to="/">Back</NuxtLink></p>
  </main>
</template>

<style scoped>
.page { max-width: 900px; margin: 0 auto; padding: 40px 24px 80px; }
.head { display: flex; flex-wrap: wrap; gap: 18px; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
.eyebrow { margin: 0 0 4px; font-size: 12px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--vv-brand); }
h1 { margin: 0 0 6px; font-size: 30px; }
h2 { margin: 0 0 6px; font-size: 18px; }
.muted, .note { color: var(--vv-muted); font-size: 14px; margin: 0 0 18px; max-width: 62ch; }
section { margin-bottom: 46px; }

.themes { display: flex; gap: 8px; }
.chip {
  padding: 8px 14px; font: inherit; font-size: 13px; font-weight: 600;
  color: var(--vv-muted); background: var(--vv-surface);
  border: none; border-radius: var(--vv-r-pill);
  box-shadow: var(--vv-e1); cursor: pointer;
}
.chip.active { color: var(--vv-accent); box-shadow: var(--vv-p1); }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 26px; }
.demo { text-align: center; }
.tile { height: 110px; margin-bottom: 12px; }
.swatch { height: 72px; }
.t-name { margin: 0; font-size: 14px; font-weight: 700; }
.t-use  { margin: 2px 0 0; font-size: 12px; color: var(--vv-muted); }
.t-spec { margin: 2px 0 0; font-size: 11px; color: var(--vv-muted-2); font-family: ui-monospace, monospace; }

.panel { padding: 26px; }
.spaced { margin-top: 16px; }

.row { display: flex; align-items: center; gap: 14px; padding: 14px 2px; }
.icon { display: grid; place-items: center; width: 42px; height: 42px; border-radius: var(--vv-r-sm); font-size: 18px; flex: none; }
.row-main { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.row-main strong { font-size: 15px; }
.row-main small { color: var(--vv-muted); font-size: 12px; }

.foot { text-align: center; }
</style>
