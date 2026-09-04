// Nuxt's equivalent of VibraFlow's proxy.ts: decides who may see which page.
const PUBLIC_PAGES = ['/login', '/signup']

export default defineNuxtRouteMiddleware(async (to) => {
  const user = useAuthUser()

  // Ask the server who we are — once per page load, not per navigation.
  if (!user.value) {
    // useRequestFetch forwards the incoming cookies during SSR; a plain $fetch
    // would arrive at /api/auth/me with no session cookie and always say null.
    const fetchWithCookies = useRequestFetch()
    try {
      user.value = await fetchWithCookies('/api/auth/me')
    } catch {
      user.value = null
    }
  }

  const isPublic = PUBLIC_PAGES.includes(to.path)

  if (!user.value && !isPublic) return navigateTo('/login')
  if (user.value && isPublic) return navigateTo('/')
})
