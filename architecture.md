# Gravity Agent Architecture Overview

This document provides a high-level overview of the architectural decisions, integration patterns, and authentication flows used in the Gravity Agent project.

## 1. Tech Stack Overview
- **Frontend & API**: Nuxt 4 (Vue 3, TypeScript, Nitro Server Engine)
- **AI Integration**: Google Gemini SDK (`@google/genai`)
- **Agent Tooling**: FastMCP (Python) server for Model Context Protocol
- **CRM System**: Salesforce
- **Deployment**: Vercel

## 2. Architecture & Integration
- **Integration Pattern**: Backend-for-Frontend (BFF) pattern using Nuxt Server Routes, combined with an MCP Server for dynamic Agent Tooling.
- **Authentication Flow**: Salesforce OAuth 2.0 via Connected App. The access token is passed from Nuxt context to the Python MCP server.
- **Data Fetching Strategy**: Agentic GraphQL for dynamic exploration, SOQL for aggregate data, and lazy fetching for UI-driven lists.

## 3. Tech Debt & Deprecation Notice (Agentic GraphQL Shift)
With the shift towards **Agentic GraphQL** via the Python MCP Server, several older architectural components are now redundant and should be scheduled for deprecation:
1. **Hardcoded BFF Routes**: Files like `Nuxt_Agent/server/api/salesforce/opportunities.get.ts` are redundant. The agent can dynamically fetch this data using the MCP GraphQL tool instead of relying on rigid REST endpoints.
2. **Duplicate Service Layers**: The `SalesforceService.ts` utility in the Nuxt backend duplicates integration logic now owned by the Python MCP server (`salesforce_service.py`).
3. **Redundant Introspection Tools**: Custom methods like `getObjectMetadata` and `findObjectApiName` (in both TS and Python) are obsolete. GraphQL natively supports schema introspection, allowing the LLM to discover objects and fields directly via the `execute_salesforce_graphql` tool.

## 4. Tradeoffs Accepted
| Decision | Alternative Considered | Why We Accepted This |
|----------|------------------------|----------------------|
| **Salesforce User OAuth (Impersonation)** | Service Account / Integration User | We chose OAuth so that Salesforce automatically enforces Field-Level Security (FLS) for each user. We traded the simplicity of a Service Account for robust, native Salesforce security. |
| **Agentic GraphQL via MCP** | Hardcoded REST Endpoints in Nuxt BFF | We accepted the risk of malformed AI queries to gain extreme flexibility. The agent can explore custom Salesforce instances dynamically without requiring new backend endpoints. |
| **BFF Pattern** | Direct frontend-to-Salesforce API calls | We traded slightly more backend routing code for enhanced security (hiding API keys) and avoiding complex browser CORS issues. |
