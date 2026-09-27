<script setup lang="ts">
/**
 * The row of bank cards. One card: it just sits there. Several (Wave 4,
 * multiple banks): the row scrolls sideways with snapping, dots show where
 * you are, and `data-swipe-lock` tells the screen-swipe to leave these
 * sideways gestures alone - the cards own them.
 */
interface Card { id: string; name: string; balanceCents: number; lastBookedAt: string | null }
const props = defineProps<{ cards: Card[] }>()
const { t } = useI18n()

const track = ref<HTMLElement | null>(null)
const active = ref(0)
const many = computed(() => props.cards.length > 1)

// Distance from one card to the next (card width + gap), measured - the
// track's padding makes "track width" the wrong unit.
function step(el: HTMLElement) {
  const [a, b] = el.children as unknown as HTMLElement[]
  return a && b ? b.offsetLeft - a.offsetLeft : el.clientWidth
}

// Which card is in view = scroll position / step, rounded.
function onScroll() {
  const el = track.value
  if (el) active.value = Math.round(el.scrollLeft / step(el))
}

function goTo(i: number) {
  const el = track.value
  if (el) el.scrollTo({ left: i * step(el), behavior: 'smooth' })
}
</script>

<template>
  <section :aria-label="t('home.accounts')">
    <div
      ref="track"
      class="track"
      :class="{ many }"
      :data-swipe-lock="many ? '' : undefined"
      @scroll.passive="onScroll"
    >
      <div
        v-for="(c, i) in cards"
        :key="c.id"
        class="slide"
        :aria-label="many ? t('home.accountN', { n: i + 1, total: cards.length }) : undefined"
      >
        <HomeBankCard :name="c.name" :balance-cents="c.balanceCents" :last-booked-at="c.lastBookedAt" />
      </div>
    </div>

    <div v-if="many" class="dots">
      <button
        v-for="(c, i) in cards"
        :key="c.id"
        type="button"
        class="dot"
        :class="{ on: i === active }"
        :aria-label="t('home.accountN', { n: i + 1, total: cards.length })"
        :aria-current="i === active ? 'true' : undefined"
        @click="goTo(i)"
      />
    </div>
  </section>
</template>

<style scoped>
/* Padding + negative margin: room for the card's shadow inside the scroller,
   which would otherwise clip it. */
.track { display: flex; margin: -24px -24px 0; padding: 24px 24px 30px; }
.track.many {
  overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none;
  gap: 24px; overscroll-behavior-x: contain;
}
.track.many::-webkit-scrollbar { display: none; }
.slide { flex: 0 0 100%; scroll-snap-align: center; }

.dots { display: flex; justify-content: center; gap: 8px; margin-top: -12px; margin-bottom: 8px; }
.dot {
  width: 8px; height: 8px; padding: 0; border: none; border-radius: 999px; cursor: pointer;
  background: var(--vv-surface); box-shadow: var(--vv-p1); transition: width .2s ease, background .2s ease;
}
.dot.on { width: 22px; background: var(--vv-accent); box-shadow: none; }
@media (prefers-reduced-motion: reduce) { .dot { transition: none; } }
@media (max-width: 560px) { .track { margin: -24px -18px 0; padding: 24px 18px 30px; } }
</style>
