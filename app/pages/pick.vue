<script setup lang="ts">
/**
 * TEMPORARY comparison page for the v2 identity decisions (typeface + icons).
 * Judged on the phone, with real content, rather than from a description.
 * Delete once both are chosen.
 *
 * Fonts come from Google's CDN on THIS page only - acceptable for a throwaway
 * page used by one person. The chosen face will be self-hosted, because
 * loading Google Fonts from Google's servers sends visitors' IPs to Google,
 * which EU courts have ruled a GDPR problem.
 */
useHead({
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;800&family=Manrope:wght@300;400;600;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,600;9..40,800&display=swap',
    },
  ],
})

const theme = useTheme()

const faces = [
  { key: 'jakarta', name: 'Plus Jakarta Sans', family: "'Plus Jakarta Sans', sans-serif", note: 'Warm, rounded, modern fintech. Softest match for neumorphism.' },
  { key: 'manrope', name: 'Manrope', family: "'Manrope', sans-serif", note: 'Geometric and precise. Very clean numbers.' },
  { key: 'dm', name: 'DM Sans', family: "'DM Sans', sans-serif", note: 'Friendly and open. Most readable at small sizes.' },
  { key: 'system', name: 'System font', family: "-apple-system, 'SF Pro Text', system-ui, sans-serif", note: 'SF Pro on your iPhone - literally the native iOS font. Different on Windows.' },
] as const

// The icons Vibravault actually needs, in the three candidate sets.
const needs = ['Home', 'Transactions', 'Add', 'Categories', 'You', 'Scan', 'Import', 'Edit', 'Delete', 'Card', 'Chart', 'Back'] as const
const sets = [
  {
    name: 'Phosphor · Light',
    note: 'Thin strokes - closest to your CKSMB inspiration.',
    icons: ['ph:house-light', 'ph:list-bullets-light', 'ph:plus-light', 'ph:tag-light', 'ph:user-light', 'ph:scan-light', 'ph:upload-simple-light', 'ph:pencil-simple-light', 'ph:trash-light', 'ph:credit-card-light', 'ph:chart-bar-light', 'ph:caret-left-light'],
  },
  {
    name: 'Lucide',
    note: 'Medium strokes, huge set, very common in modern apps.',
    icons: ['lucide:house', 'lucide:list', 'lucide:plus', 'lucide:tag', 'lucide:user', 'lucide:scan-line', 'lucide:upload', 'lucide:pencil', 'lucide:trash-2', 'lucide:credit-card', 'lucide:chart-column', 'lucide:chevron-left'],
  },
  {
    name: 'Tabler',
    note: 'Slightly heavier and very consistent. Largest set of the three.',
    icons: ['tabler:home', 'tabler:list', 'tabler:plus', 'tabler:tag', 'tabler:user', 'tabler:scan', 'tabler:upload', 'tabler:pencil', 'tabler:trash', 'tabler:credit-card', 'tabler:chart-bar', 'tabler:chevron-left'],
  },
]

// Iconify serves plain SVG. A mid grey that reads in both light and dark mode.
const iconUrl = (name: string) => `https://api.iconify.design/${name}.svg?color=%23888780`
</script>

<template>
  <div class="pick">
    <header class="head">
      <div>
        <h1>Pick a typeface &amp; icons</h1>
        <p class="muted">Same content in each. Look at it on your phone, in both light and dark.</p>
      </div>
      <button class="chip" type="button" @click="theme = theme === 'dark' ? 'light' : 'dark'">
        {{ theme === 'dark' ? 'Light' : 'Dark' }} mode
      </button>
    </header>

    <!-- ===== TYPEFACES ===== -->
    <h2 class="section">1 · Typeface</h2>
    <div class="faces">
      <section v-for="(f, i) in faces" :key="f.key" class="neu-3 face" :style="{ fontFamily: f.family }">
        <p class="tag">{{ i + 1 }} — {{ f.name }}</p>

        <p class="label">Balance</p>
        <p class="balance">€ 1.234,56</p>

        <p class="headline"><strong>Your spending</strong> <span>this month</span></p>

        <div class="row">
          <span class="tile neu">🛒</span>
          <span class="row-main">
            <strong>Colruyt</strong>
            <small>Boodschappen · 24 sep</small>
          </span>
          <span class="amt">−€ 42,18</span>
        </div>
        <div class="row">
          <span class="tile neu">💼</span>
          <span class="row-main">
            <strong>Accent Jobs</strong>
            <small>Loon · week 39</small>
          </span>
          <span class="amt in">+€ 412,60</span>
        </div>

        <p class="dutch">Maaltijdcheques · Eindejaarspremie · Vakantiegeld</p>
        <p class="note">{{ f.note }}</p>
      </section>
    </div>

    <!-- ===== ICONS ===== -->
    <h2 class="section">2 · Icons</h2>
    <div class="sets">
      <section v-for="(s, i) in sets" :key="s.name" class="neu-3 set">
        <p class="tag">{{ String.fromCharCode(65 + i) }} — {{ s.name }}</p>
        <div class="grid">
          <div v-for="(icon, j) in s.icons" :key="icon" class="cell">
            <span class="icon-tile neu-2"><img :src="iconUrl(icon)" :alt="needs[j]" width="24" height="24" /></span>
            <span class="cap">{{ needs[j] }}</span>
          </div>
        </div>
        <!-- How it would look in the bottom bar, at nav size -->
        <div class="bar neu-2">
          <img v-for="n in [0, 1, 3, 4]" :key="n" :src="iconUrl(s.icons[n]!)" :alt="needs[n]" width="22" height="22" />
        </div>
        <p class="note">{{ s.note }}</p>
      </section>
    </div>

    <p class="answer">Tell me a number and a letter — e.g. <strong>“1 and A”</strong>.</p>
  </div>
</template>

<style scoped>
.pick { padding-bottom: 20px; }
.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 8px; }
h1 { margin: 0 0 4px; font-size: 24px; }
.muted { margin: 0; color: var(--vv-muted); font-size: 14px; }
.chip {
  padding: 9px 14px; font: inherit; font-size: 13px; font-weight: 600; white-space: nowrap;
  color: var(--vv-muted); background: var(--vv-surface); border: none;
  border-radius: var(--vv-r-badge); box-shadow: var(--vv-e1); cursor: pointer;
}
.section { margin: 30px 0 14px; font-size: 13px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--vv-brand); }

.faces, .sets { display: grid; gap: 18px; }
@media (min-width: 760px) { .faces { grid-template-columns: 1fr 1fr; } }

.face { padding: 22px; }
.tag { margin: 0 0 16px; font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--vv-brand); }
.label { margin: 0; font-size: 12px; font-weight: 400; color: var(--vv-muted); text-transform: uppercase; letter-spacing: .1em; }
.balance { margin: 2px 0 16px; font-size: 38px; font-weight: 800; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.headline { margin: 0 0 14px; font-size: 22px; line-height: 1.2; }
.headline strong { font-weight: 800; display: block; }
.headline span { font-weight: 300; color: var(--vv-muted); }

.row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--vv-shadow-dark); }
.row:last-of-type { border-bottom: none; }
.tile { display: grid; place-items: center; width: 38px; height: 38px; flex: none; border-radius: var(--vv-r-sm); font-size: 17px; }
.row-main { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.row-main strong { font-size: 15px; font-weight: 600; }
.row-main small { font-size: 12px; font-weight: 400; color: var(--vv-muted); }
.amt { font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; }
.amt.in { color: var(--vv-accent); }

.dutch { margin: 14px 0 0; font-size: 13px; color: var(--vv-muted); }
.note { margin: 12px 0 0; font-size: 12px; color: var(--vv-muted-2); font-family: ui-sans-serif, system-ui, sans-serif; }

.set { padding: 22px; }
.grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px 8px; }
@media (max-width: 440px) { .grid { grid-template-columns: repeat(4, 1fr); } }
.cell { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.icon-tile { display: grid; place-items: center; width: 46px; height: 46px; border-radius: var(--vv-r-sm); }
.cap { font-size: 10px; color: var(--vv-muted-2); }
.bar { display: flex; justify-content: space-around; margin-top: 18px; padding: 12px; border-radius: var(--vv-r-md); }

.answer { margin: 28px 0 0; text-align: center; font-size: 15px; color: var(--vv-muted); }
</style>
