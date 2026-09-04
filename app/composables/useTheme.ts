export type Theme = 'system' | 'light' | 'dark'

/**
 * Theme preference, stored in a cookie rather than localStorage so the SERVER
 * knows it too. That lets app.vue render `data-theme` into the HTML on the
 * first response — no flash of the wrong theme before hydration.
 *
 * 'system' deliberately writes no attribute, so the CSS
 * `prefers-color-scheme` media query takes over.
 */
export const useTheme = () =>
  useCookie<Theme>('vv-theme', {
    default: () => 'system',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    path: '/',
  })
