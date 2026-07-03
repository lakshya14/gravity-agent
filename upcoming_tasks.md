# Gravity Agent: Upcoming Tasks & Roadmap

This document serves as a persistent roadmap for the Gravity Agent project, ensuring our architectural goals are tracked across development sessions.

## 🟢 Priority 1: Model Context Protocol (MCP) Foundation
*Goal: Establish a standardized interface for the agent to access external tools (Salesforce, Graph DB, Vector DB) cleanly, using a separate Python MCP server (`salesforce_mcp`).*
- `[ ]` Set up and run the Python FastMCP server (`salesforce_mcp`).
- `[ ]` Set up the base MCP client in the Nuxt orchestrator to connect to the Python server.
- `[ ]` Refactor the existing Gemini initialization to connect via the MCP client.

## 🟡 Priority 2: Agentic GraphQL (Real-Time Retrieval)
*Goal: Allow the LLM to dynamically fetch live Salesforce schema and records via our Python MCP server.*
- `[ ]` Implement `execute_graphql` in `salesforce_service.py` using the Salesforce GraphQL API.
- `[ ]` Register `execute_salesforce_graphql` as a tool within the Python MCP server.
- `[ ]` Test fetching live schema directly and evaluate latency/accuracy.

## 🟠 Priority 3: Graph DB Pipeline (GraphRAG)
*Goal: Accurately model and traverse the complex, relational Salesforce schema.*
- `[ ]` Set up Neo4j AuraDB (free tier) and install `neo4j-driver`.
- `[ ]` Design the "Ontology": Translate Salesforce schema JSON into Graph Nodes (Objects/Fields) and Edges (Relationships).
- `[ ]` Write and execute an ingestion script to populate the Graph DB.
- `[ ]` Register `query_neo4j_graph` as a tool within the MCP server.
- `[ ]` Test multi-hop reasoning (e.g., impact analysis and relationship routing).

## ⚪ Backlog (De-prioritized / Future Scope)
### Vector DB for Unstructured Knowledge
*Architectural Note: Initially considered for schema storage, but de-prioritized because schema is highly relational (better suited for a Graph DB). Vector DBs will be introduced later for semantic search over unstructured text.*
- `[ ]` Generate or source a mock dataset of "Past IT Support Tickets" or Salesforce Developer documentation.
- `[ ]` Set up a lightweight Vector DB (e.g., Pinecone).
- `[ ]` Build a pipeline to generate text embeddings and store the mock data.
- `[ ]` Register `search_vector_docs` as a tool within the MCP server.
- `[ ]` Implement Hybrid RAG (Graph + Vector via MCP).
