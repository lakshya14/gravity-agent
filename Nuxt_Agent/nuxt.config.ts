// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

  runtimeConfig: {
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiApiKey2: process.env.GEMINI_API_KEY2,
    salesforceClientId: process.env.SALESFORCE_CLIENT_ID,
    salesforceClientSecret: process.env.SALESFORCE_CLIENT_SECRET,
    salesforceLoginUrl: process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com',
    sessionPassword: process.env.NUXT_SESSION_PASSWORD || 'default-password-for-dev-must-be-at-least-32-chars-long',
  },

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      title: 'Gravity — Intelligent Search & AI Assistant',
      htmlAttrs: { lang: 'en' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'Gravity is your intelligent search platform powered by AI. Ask questions in natural language and get instant, accurate answers.',
        },
        { name: 'theme-color', content: '#0a0e1a' },
      ],
      link: [
        {
          rel: 'preconnect',
          href: 'https://fonts.googleapis.com',
        },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: '',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
        },
      ],
    },
  },
})
