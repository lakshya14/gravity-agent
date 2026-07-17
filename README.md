# Gravity Agent

Gravity is an **integration architecture** that connects a modern AI agent to Salesforce CRM and a Neo4j Graph Database. It bridges a Nuxt 4 web interface, Google Gemini AI, and a Python MCP server into a single cohesive platform where users can interact with their Salesforce data — including relationship-aware graph queries — through natural language.

**Live Project:** [View Live on Render](https://gravity-agent-v4.onrender.com)

### How it fits together

```
User → Nuxt BFF → Gemini LLM → Python MCP Server → Salesforce / Neo4j
```

- The **Nuxt BFF** handles the UI, Salesforce OAuth, and LLM orchestration.
- The **Python MCP Server** gives the LLM a set of tools (agentic GraphQL, SOQL, Cypher) to dynamically query Salesforce and Neo4j.
- **Neo4j AuraDB** stores Salesforce entity relationships as a graph, enabling multi-hop reasoning (e.g., "which accounts have the most high-value opportunities?").
- **Hardcoded BFF routes** power deterministic UI views (dashboards, forms) without LLM involvement.

> See [architecture.md](./architecture.md) for the full data-flow diagram, responsibility boundaries, and tradeoffs.

## Tech Stack

- **Frontend & API**: Nuxt 4 (Vue 3, Nitro Server Engine)
- **AI Integration**: Google Gemini SDK (`@google/genai`)
- **Agent Tooling**: FastMCP (Python) server
- **Graph Database**: Neo4j AuraDB (Cypher)
- **CRM System**: Salesforce (OAuth 2.0 Connected App)
- **Deployment**: Render

## Project Structure

- `/Nuxt_Agent`: The Nuxt 4 web application and BFF (Backend-for-Frontend). Handles Salesforce OAuth, UI, and LLM orchestration.
- `/gravity-mcp-core`: Python FastMCP server. Provides dynamic Agentic GraphQL, SOQL, and Neo4j Graph DB tools to the LLM.

## Local Development Setup

### 1. Prerequisites
- Node.js (v22+)
- Python (3.10+)
- Google Gemini API Key
- Salesforce Developer Org with a configured Connected App/External Client App (OAuth)

### 2. Environment Variables

**Nuxt Agent** — Create a `.env` file inside the `Nuxt_Agent` directory:

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

**MCP Server** — Create a `.env` file inside the `gravity-mcp-core` directory:

```env
# Neo4j AuraDB
NEO4J_URI=neo4j+ssc://your-instance.databases.neo4j.io
NEO4J_USERNAME=your_username
NEO4J_PASSWORD=your_password
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
1. The **Python MCP Backend** (Deployed at: `https://gravity-mcp-core-v4.onrender.com`).
2. The **Nuxt Frontend** (requires all the environment variables listed above, with `MCP_SERVER_URL` set to `https://gravity-mcp-core-v4.onrender.com/sse/`).
