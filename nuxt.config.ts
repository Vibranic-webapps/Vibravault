export default defineNuxtConfig({
  modules: ['@pinia/nuxt', '@nuxtjs/i18n'],
  devtools: { enabled: true },

  // Own dev port. Vibradex, VibraFlow and the portfolio all default to 3000,
  // and a browser keys service workers, localStorage and cache per ORIGIN -
  // scheme + host + PORT. Sharing localhost:3000 meant Vibradex's Web Push
  // service worker stayed registered "on Vibravault", producing
  // the Vue Router warning for /sw.js, and made tests hit the wrong app.
  devServer: { port: 3002 },
  typescript: { strict: true },
  // The typeface is served from this site, not Google's CDN: loading Google
  // Fonts from Google sends each visitor's IP to Google, which EU courts have
  // ruled a GDPR problem. The variable font covers every weight in one file.
  css: ['@fontsource-variable/plus-jakarta-sans', '~/assets/css/main.css'],

  // Dutch + English (decided 2026-09-26).
  // - no_prefix: URLs stay the same in both languages. This is an app opened
  //   from a home-screen icon, not a site that needs /nl/ pages for search.
  // - First visit follows the phone's language; the choice made in the
  //   "You" tab is remembered in a cookie, so the SERVER renders the right
  //   language too (no flash of English before Dutch).
  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'en',
    locales: [
      { code: 'en', language: 'en-GB', name: 'English', file: 'en.json' },
      { code: 'nl', language: 'nl-BE', name: 'Nederlands', file: 'nl.json' },
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'vv-lang',
      alwaysRedirect: false,
      fallbackLocale: 'en',
    },
  },
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL,
  },

  app: {
    head: {
      // viewport-fit=cover lets the app draw edge to edge, under the notch and
      // the home indicator. The CSS then keeps content OUT of those areas with
      // env(safe-area-inset-*), so nothing ends up hidden behind them.
      viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
      title: 'Vibravault',
      link: [
        // The manifest is what makes this INSTALLABLE: "display": "standalone"
        // means that when launched from the home-screen icon there is no
        // browser around it - no address bar, no toolbar, no tabs.
        { rel: 'manifest', href: '/manifest.webmanifest' },
        // iOS ignores manifest icons for the home screen and wants this file.
        // Without it, iOS uses a shrunken screenshot of the page as the icon.
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
      meta: [
        // Older iOS reads these instead of the manifest; kept for both.
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-title', content: 'Vibravault' },
        // "default" = dark status-bar text on a light bar. "black-translucent"
        // looks more native but forces WHITE text, which would be invisible on
        // the cream light theme.
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        // Tints the system bars to match each theme's surface.
        { name: 'theme-color', content: '#F7F5F1', media: '(prefers-color-scheme: light)' },
        { name: 'theme-color', content: '#1E1E1E', media: '(prefers-color-scheme: dark)' },
      ],
    },
  },
})
