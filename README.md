# Gravity Agent

Gravity is an intelligent search and AI assistant project. It integrates a modern web interface built with Nuxt with the power of Google Gemini AI and Salesforce data using a streamlined Backend-for-Frontend (BFF) architecture.

**Live Project:** [View on Vercel](https://gravity-agent.vercel.app)

## Tech Stack
*   **Frontend & API:** Nuxt 4 (Vue 3, Nitro Server Engine, TypeScript)
*   **AI:** Google Gemini SDK (`@google/genai`)
*   **CRM Integration:** Salesforce REST APIs via custom Nuxt Services
*   **Deployment:** Vercel

## Local Development Setup

### 1. Prerequisites
*   Node.js (v22+)
*   A Google Gemini API Key
*   Salesforce Org credentials

### 2. Environment Variables
Create a `.env` file inside the `Nuxt_Agent` directory:

```env
# AI Keys
GEMINI_API_KEY=your_primary_gemini_key

# Salesforce Connected App
SALESFORCE_CLIENT_ID=your_client_id
SALESFORCE_CLIENT_SECRET=your_client_secret
SALESFORCE_LOGIN_URL=https://login.salesforce.com

# Nuxt Setup
NUXT_SESSION_PASSWORD=a_secure_random_password_at_least_32_chars_long
```

### 3. Start the Application
Clone the repository and run the local Nuxt development server:

```bash
cd Nuxt_Agent
npm install
npm run dev
```
*Available at `http://localhost:3000`*
