# Gravity Agent Architecture Overview

This document provides a high-level overview of the architectural decisions and integration patterns used in the `main` branch of Gravity Agent.

## 1. Tech Stack Overview
- **Frontend & API**: Nuxt 4 (Vue 3, TypeScript, Nitro Server Engine)
- **AI Integration**: Google Gemini SDK (`@google/genai`)
- **CRM System**: Salesforce
- **Deployment**: Vercel

## 2. Architecture & Integration
- **Integration Pattern**: Backend-for-Frontend (BFF) pattern using Nuxt Server Routes. The API layer directly utilizes TypeScript-based services (`GeminiService` and `SalesforceService`) rather than delegating to an external agent server.
- **Authentication Flow**: Salesforce OAuth 2.0 via Connected App. The Nuxt backend handles the OAuth callback and securely stores tokens in a session.
- **Data Fetching Strategy**: Server-side requests directly interface with Salesforce REST APIs using the session's access token, ensuring API keys and secrets remain hidden from the client.

## 3. Tradeoffs Accepted
| Decision | Alternative Considered | Why We Accepted This |
|----------|------------------------|----------------------|
| **Salesforce User OAuth (Impersonation)** | Service Account / Integration User | We chose OAuth so that Salesforce automatically enforces Field-Level Security (FLS) for each user. We traded the simplicity of a Service Account for robust, native Salesforce security. |
| **Monolithic TypeScript BFF** | Polyglot (Nuxt + Python MCP Server) | We accepted the monolithic Nuxt app structure on `main` to simplify deployment to a single Vercel instance and reduce architectural complexity, trading away the decoupled tool expansion offered by Python MCP. |
| **BFF Pattern** | Direct frontend-to-Salesforce API calls | We traded slightly more backend routing code for enhanced security (hiding API keys) and avoiding complex browser CORS issues. |
