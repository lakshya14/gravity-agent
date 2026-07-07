# Gravity Agent

Gravity is an intelligent search and AI assistant project. It integrates a modern web interface built with Nuxt, the reasoning power of Google Gemini AI, and dynamic Salesforce integration using a Backend-for-Frontend (BFF) and Model Context Protocol (MCP) architecture.

**Live Project:** [View Live on Render](https://gravity-agent-v3.onrender.com)

## Tech Stack

- **Frontend & API**: Nuxt 4 (Vue 3, Nitro Server Engine)
- **AI Integration**: Google Gemini SDK (`@google/genai`)
- **Agent Tooling**: FastMCP (Python) server
- **CRM System**: Salesforce (OAuth 2.0 Connected App)
- **Deployment**: Render

## Project Structure

- `/Nuxt_Agent`: The Nuxt 4 web application and BFF (Backend-for-Frontend). Handles Salesforce OAuth, UI, and LLM orchestration.
- `/gravity-mcp-core`: Python FastMCP server. Provides dynamic Agentic GraphQL and SOQL tools to the LLM.

## Local Development Setup

### 1. Prerequisites
- Node.js (v22+)
- Python (3.10+)
- Google Gemini API Key
- Salesforce Developer Org with a configured Connected App (OAuth)

### 2. Environment Variables
Create a `.env` file inside the `Nuxt_Agent` directory:

```env
# AI Keys
GEMINI_API_KEY=your_primary_gemini_key
GEMINI_API_KEY2=your_fallback_gemini_key # Optional

# Salesforce Connected App
SALESFORCE_CLIENT_ID=your_client_id
SALESFORCE_CLIENT_SECRET=your_client_secret
SALESFORCE_LOGIN_URL=https://login.salesforce.com

# Nuxt & MCP Setup
NUXT_SESSION_PASSWORD=a_secure_random_password_at_least_32_chars_long
APP_BASE_URL=http://localhost:3000
MCP_SERVER_URL=http://127.0.0.1:8000/sse/
```

### 3. Running the Python MCP Server
Open a terminal and start the backend:
```bash
cd gravity-mcp-core
pip install -r requirements.txt # (or use your virtual environment)
python server.py
```
*Runs on `http://127.0.0.1:8000`*

### 4. Running the Nuxt Application
Open a second terminal and start the frontend:
```bash
cd Nuxt_Agent
npm install
npm run dev
```
*Available at `http://localhost:3000`*

## Deployment

This project is deployed on [Render](https://render.com) as two separate Web Services:
1. The **Python MCP Backend** (requires `PORT` environment variable).
2. The **Nuxt Frontend** (requires all the environment variables listed above, with `MCP_SERVER_URL` pointing to your deployed Python backend URL).
