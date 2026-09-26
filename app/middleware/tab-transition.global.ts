/**
 * Slide direction between the main screens. Going to a tab further RIGHT in
 * the bar slides the new page in from the right, and the other way round, so
 * a tap and a swipe feel the same. Every other navigation (login, import,
 * settings...) gets no slide at all.
 */
export default defineNuxtRouteMiddleware((to, from) => {
  const a = tabIndex(from.path)
  const b = tabIndex(to.path)

  if (import.meta.server || a < 0 || b < 0 || a === b) {
    to.meta.pageTransition = false
    return
  }
  to.meta.pageTransition = { name: b > a ? 'tab-next' : 'tab-prev', mode: 'out-in' }
})
