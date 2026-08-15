# Gravity Agent

Gravity is an **AI agent platform** that lets users interact with Salesforce CRM data — including relationship-aware graph queries and semantic search over unstructured documents — through natural language.

It bridges a Nuxt 4 web interface, Google Gemini AI, and a Python MCP server into a single integration architecture. It features modular data capabilities, allowing you to optionally enable Neo4j for multi-hop relationship reasoning and Neon Postgres for vector-based semantic search.

**Live Project:** [View Live on Render](https://gravity-agent-v4.onrender.com)

## How It Fits Together

```
User → Nuxt BFF → Gemini LLM → Python MCP Server → Salesforce / Neo4j
```

- The **Nuxt BFF** handles the UI, Salesforce OAuth, and LLM orchestration.
- The **Python MCP Server** gives the LLM a set of tools (agentic GraphQL, SOQL, Cypher, Vector Search) to dynamically query Salesforce, Neo4j, and Postgres.
- **Neo4j AuraDB** (Optional) stores Salesforce entity relationships as a graph, enabling multi-hop reasoning (e.g., "which accounts have the most high-value opportunities?").
- **Neon Postgres** (Optional) uses `pgvector` to store document embeddings, enabling Semantic Search/RAG over unstructured data.
- **Hardcoded BFF routes** power deterministic UI views (dashboards, forms) without LLM involvement.

> See [architecture.md](./architecture.md) for the full data-flow diagram, responsibility boundaries, and tradeoffs.

## Tech Stack

- **Frontend & API**: Nuxt 4 (Vue 3, TypeScript, Nitro)
- **AI Integration**: Google Gemini SDK (`@google/genai`)
- **Agent Tooling**: FastMCP (Python) server
- **Graph Database**: Neo4j AuraDB (Cypher) - *Optional*
- **Vector Database**: PostgreSQL/Neon Serverless (`pgvector`) - *Optional*
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
- *(Optional - for Graph Reasoning)*: Neo4j AuraDB instance (free tier available)
- *(Optional - for Semantic Search/RAG)*: Neon Postgres instance (free tier available)

### 2. Environment Variables

**Nuxt App** — Create a `.env` file inside the `Nuxt_Agent` directory:

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
# Optional: For Graph Reasoning
NEO4J_URI=neo4j+ssc://your-instance.databases.neo4j.io
NEO4J_USERNAME=your_username
NEO4J_PASSWORD=your_password

# Optional: For Semantic Search / RAG
NEON_DATABASE_URL=postgres://your_username:your_password@ep-your-instance.region.aws.neon.tech/neondb
```

### 3. Database Setup (Optional)

Depending on which agent capabilities you want to test, you can run the provided setup scripts before starting the server.

> **Note on Graceful Degradation:** The MCP server is fully modular. It will boot perfectly even if you only configure the core Salesforce credentials. It dynamically detects missing environment variables and automatically disables the Graph and Vector tools, ensuring the core app remains resilient.

- **For Semantic Search/RAG**: Run `python db_setup.py` to create the Postgres tables, followed by `python vector_ingestion.py` to embed and load sample documents.
- **For Graph Reasoning**: Run `python neo4j_ingestion.py` to sync Salesforce data into Neo4j.

### 4. Running the Python MCP Server

> Start the MCP server first — the Nuxt app connects to it on startup.

Open a terminal and start the backend:
```bash
cd gravity-mcp-core
pip install -r requirements.txt # (or use your virtual environment)
python server.py
```
*Runs on `http://127.0.0.1:8000`*

### 5. Running the Nuxt Application
Open a second terminal and start the frontend:
```bash
cd Nuxt_Agent
npm install
npm run dev
```
*Available at `http://localhost:3000`*

## Deployment

This project is deployed on [Render](https://render.com) (free tier) as two separate Web Services from the same monorepo:

| Service | Root Directory | Build Command | Start Command |
|---|---|---|---|
| **Nuxt Frontend** | `Nuxt_Agent` | `npm install && npm run build` | `node .output/server/index.mjs` |
| **Python MCP Backend** | `gravity-mcp-core` | `pip install -r requirements.txt` | `python server.py` |

The Nuxt service requires all the environment variables listed above, with `MCP_SERVER_URL` pointing to the MCP backend's deployed URL.

> **Note:** Render free-tier services spin down after ~15 minutes of inactivity. The first request after idle may take 30–60s while the services cold-start.
