# Gravity Agent

Gravity is an intelligent search and AI assistant project. It integrates a modern web interface built with Nuxt with the power of Google Gemini AI and Salesforce data. 

**Live Project:** [View Live on Vercel](https://gravity-agent.vercel.app) *(Note: update this link with your exact Vercel URL)*

## Tech Stack

*   **Frontend & API:** Nuxt (Vue 3, Nitro Server Engine)
*   **AI:** Google Gemini SDK (`@google/genai`)
*   **CRM Integration:** Salesforce REST APIs
*   **Deployment:** Vercel (Serverless Edge)

## Project Structure

*   `/Nuxt_Agent`: Contains the Nuxt 4 application.
    *   `/server/api/chat.post.ts`: Handles communication with Google Gemini.
    *   `/server/api/salesforce/...`: Endpoints for fetching Salesforce data.
    *   `/components`: Reusable Vue components (e.g., AgentChat, OpportunitiesDashboard).

## Local Development Setup

### 1. Prerequisites
*   Node.js (v22 or higher recommended)
*   A Google Gemini API Key
*   Salesforce Developer Org credentials

### 2. Installation
Clone the repository and install the dependencies for the Nuxt application:

```bash
cd Nuxt_Agent
npm install
```

### 3. Environment Variables
Create a `.env` file inside the `Nuxt_Agent` directory. **Never commit this file to version control.**

```env
GEMINI_API_KEY=your_gemini_api_key_here
# Add your Salesforce integration keys here as needed
```

### 4. Start the Development Server
Run the local Nuxt development server:

```bash
npm run dev
```
The application will be available at `http://localhost:3000`.

## Deployment

This project is configured to be seamlessly deployed on [Vercel](https://vercel.com).
*   Connect the repository to Vercel.
*   Set the **Root Directory** to `Nuxt_Agent`.
*   Ensure all keys from your `.env` file are added to the Vercel Environment Variables settings.
