export default defineNuxtConfig({
  modules: ['@pinia/nuxt'],
  devtools: { enabled: true },
  typescript: { strict: true },
  css: ['~/assets/css/main.css'],
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
