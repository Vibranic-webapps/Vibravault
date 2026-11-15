/**
 * Load what a main screen needs WITHOUT making the navigation wait for it.
 *
 * Before: every tab did `await fetch()` in its setup, so a swipe stood still
 * until Neon + Vercel answered (1-2 s). Now the screen opens at once with
 * whatever the stores already hold (stale-while-revalidate) and fills in as
 * the fresh data arrives.
 *
 * On the SERVER the render still waits for the load, so a first visit or a
 * hard refresh arrives complete (no flash of empty cards). The stores and
 * useAsyncData swallow their own errors, so this never throws.
 */
export function useScreenData(load: () => Promise<unknown>): Promise<unknown> {
  const started = load()
  if (import.meta.server) onServerPrefetch(() => started)
  return started
}
