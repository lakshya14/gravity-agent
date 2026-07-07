# Gravity Agent Architecture Overview

This document provides a high-level overview of the architectural decisions, integration patterns, and authentication flows used in the Gravity Agent project.

## 1. Tech Stack Overview
- **Frontend & API**: Nuxt 4 (Vue 3, TypeScript, Nitro Server Engine)
- **AI Integration**: Google Gemini SDK (`@google/genai`)
- **Agent Tooling**: FastMCP (Python) server for Model Context Protocol
- **CRM System**: Salesforce
- **Deployment**: Render

## 2. Architecture & Integration
- **Integration Pattern**: Backend-for-Frontend (BFF) pattern using Nuxt Server Routes, combined with an MCP Server (using Streamable JSON-RPC) for dynamic Agent Tooling.
- **Authentication Flow**: Salesforce OAuth 2.0 via Connected App. The access token is passed from Nuxt context to the Python MCP server.
- **Data Fetching Strategy**: Agentic GraphQL for dynamic exploration, SOQL for aggregate data, and lazy fetching for UI-driven lists.

## 3. Tradeoffs Accepted
| Decision | Alternative Considered | Why We Accepted This |
|----------|------------------------|----------------------|
| **Salesforce User OAuth (Impersonation)** | Service Account / Integration User | We chose OAuth so that Salesforce automatically enforces Field-Level Security (FLS) for each user. We traded the simplicity of a Service Account for robust, native Salesforce security. |
| **Agentic GraphQL via MCP** | Hardcoded REST Endpoints for all data access | We accepted the risk of malformed AI queries (hallucinations) to gain extreme flexibility. The agent can explore custom Salesforce instances dynamically without requiring new backend endpoints. |
| **Keeping Hardcoded BFF Routes for UI** | Full transition to Agentic GraphQL for everything | We retained hardcoded BFF routes (e.g., `opportunities.get.ts`) and `SalesforceService.ts` to power specific, deterministic UI dashboards and forms, avoiding the latency and unreliability of an LLM formulating queries for standard views. |
| **Custom MCP Introspection Tool** | Full GraphQL Schema Introspection | We retained the custom `find_object_api_name` MCP tool in Python because standard Salesforce GraphQL schema introspection is massively heavy and costly. This optimization prevents performance bottlenecks for the LLM. |
| **BFF Pattern** | Direct frontend-to-Salesforce API calls | We traded slightly more backend routing code for enhanced security (hiding API keys) and avoiding complex browser CORS issues. |
