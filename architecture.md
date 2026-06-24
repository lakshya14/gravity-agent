# Gravity Agent Architecture Overview

This document provides a high-level overview of the architectural decisions, integration patterns, and authentication flows used in the Gravity Agent project.

## 1. Tech Stack Overview
- **Frontend & API**: Nuxt 4 (Vue 3, TypeScript, Nitro Server Engine)
- **AI Integration**: Google Gemini SDK (`@google/genai`)
- **CRM System**: Salesforce
- **Deployment**: Vercel

## 2. Architecture & Integration
- **Integration Pattern**: Backend-for-Frontend (BFF) pattern using Nuxt Server Routes.
- **Authentication Flow**: Salesforce OAuth 2.0 via Connected App.
- **Data Fetching Strategy**: Lazy Fetching (fetch minimal data for lists, fetch detailed data on user interaction).

## 3. Tradeoffs Accepted
| Decision | Alternative Considered | Why We Accepted This |
|----------|------------------------|----------------------|
| **Salesforce User OAuth (Impersonation)** | Service Account / Integration User | We chose OAuth so that Salesforce automatically enforces Field-Level Security (FLS) for each user. We traded the simplicity of a Service Account for robust, native Salesforce security. |
| **Lazy Fetching for Details** | Pre-fetching all details on list load | We chose lazy fetching to keep the initial list load fast, trading off a slight delay when opening a specific record's edit modal. |
| **BFF Pattern** | Direct frontend-to-Salesforce API calls | We traded slightly more backend routing code for enhanced security (hiding API keys) and avoiding complex browser CORS issues. |
