export type GoalCardLook = 'window' | 'fill'

/**
 * TEMPORARY comparison switch (2026-11-15): which Home goal card look wins?
 *  - 'window': the picture sits whole in a tinted window on the raised card (taste brief pin 17)
 *  - 'fill':   the picture fills the card, text on a dark fade
 * Kept in localStorage so the phone remembers the pick. Once Kilian chooses, delete
 * this composable, the switch in index.vue and the losing look in GoalCarousel.vue.
 */
export function useGoalCardLook() {
  const look = useState<GoalCardLook>('goal-card-look', () => 'window')
  onMounted(() => {
    const saved = localStorage.getItem('vv-goal-look')
    if (saved === 'window' || saved === 'fill') look.value = saved
  })
  function toggle() {
    look.value = look.value === 'window' ? 'fill' : 'window'
    localStorage.setItem('vv-goal-look', look.value)
  }
  return { look, toggle }
}
