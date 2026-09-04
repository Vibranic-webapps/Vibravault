export default defineNuxtConfig({
  devtools: { enabled: true },
  typescript: { strict: true },
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL,
  },
})
