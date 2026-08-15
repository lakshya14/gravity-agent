import os
import re
import asyncio
import logging
from typing import Dict, Any
import uvicorn
from fastapi import FastAPI, Request
from contextvars import ContextVar
from mcp.server.fastmcp import FastMCP
from mcp.server.sse import SseServerTransport

from salesforce_service import SalesforceService
from neo4j_service import Neo4jService
from hydration_service import HydrationService
import structlog
from dotenv import load_dotenv
from vector_service import VectorService

# Load environment variables from .env file
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gravity_mcp")

# Initialize the main FastMCP server
mcp = FastMCP(name="GravityCore")

# Context variable to hold the SalesforceService for the current request
current_sf_service: ContextVar[SalesforceService] = ContextVar("current_sf_service")

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars, # Pulls in our correlation ID!
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ]
)
logger = structlog.get_logger("gravity_mcp")
# Validate Neo4j environment variables before initializing the driver
neo4j_uri = os.getenv("NEO4J_URI")
neo4j_username = os.getenv("NEO4J_USERNAME")
neo4j_password = os.getenv("NEO4J_PASSWORD")

neo4j_service = None
if all([neo4j_uri, neo4j_username, neo4j_password]):
    neo4j_service = Neo4jService(
        uri=neo4j_uri,
        username=neo4j_username,
        password=neo4j_password
    )
    logger.info("Neo4jService initialized successfully.")
else:
    logger.warning("Neo4j environment variables missing. Graph reasoning tools will be DISABLED.")

hydration_service = HydrationService()

# VectorService initialized once as a module-level singleton.
# Its internal ThreadedConnectionPool is reused across all tool calls.
vector_service = None
if os.getenv("NEON_DATABASE_URL"):
    vector_service = VectorService()
    logger.info("VectorService initialized successfully.")
else:
    logger.warning("NEON_DATABASE_URL missing. Vector search tools will be DISABLED.")

# Define tools using FastMCP
if neo4j_service:
    @mcp.tool()
    async def query_neo4j_graph(query: str) -> dict:
        """
        USE THIS TOOL when the user asks about relationships, networks, connections,
        or ownership patterns across Accounts, Opportunities, and Users (reps/owners).
    
        This tool executes Cypher against the Neo4j Graph Database and then
        automatically enriches the results with live Salesforce data using
        the current user's permissions. Results respect Salesforce FLS/OLS.
    
        CRITICAL SCHEMA INFORMATION:
        - Node `Account`     : id, name, industry, country, type
        - Node `Opportunity` : id, name, stageName, closeDate, type
        - Node `User`        : id, name, title  (the record owner / sales rep)
        - Relationship `(a:Account)-[:HAS_OPPORTUNITY]->(o:Opportunity)`
        - Relationship `(u:User)-[:OWNS]->(a:Account)`
        - Relationship `(u:User)-[:OWNS]->(o:Opportunity)`
        - You CAN filter/sort by any structural property directly in Cypher.
        - DO NOT query for Amount, AnnualRevenue, Email, Phone in Cypher — those
          are FLS-sensitive and are hydrated automatically from Salesforce after traversal.
        - User nodes are NOT hydrated by Salesforce — name and title are already
          stored in the graph and are safe to return directly from Cypher.
    
        RESPONSE FORMAT:
        Returns a dict with:
        - `results`: List of hydrated records with full Salesforce properties.
        - `metadata`: { total, hydrated, redacted_count, truncated_count }
    
        If `redacted_count > 0`, some records were hidden due to user permissions.
        If `truncated_count > 0`, results were capped at 50 for performance.
    
        Do NOT use this tool for fetching simple live, single-record updates from Salesforce.
    
        Args:
            query: The Cypher query string to execute.
        """
        sf_service = current_sf_service.get()
        
        # Check for mutating queries
        upper_query = query.upper()
        mutating_keywords = ["CREATE", "MERGE", "SET", "DELETE", "REMOVE", "DROP", "CALL"]
        
        # We check for whole words to avoid matching properties like "createdAt"
        has_mutation = any(re.search(rf"\b{kw}\b", upper_query) for kw in mutating_keywords)
        
        if has_mutation:
            profile_name = await sf_service.get_current_user_profile()
            if profile_name != "System Administrator":
                return {
                    "error": "Write operations to the Graph Database are restricted to System Administrators to prevent data loss. Only READ queries are allowed.",
                    "results": [],
                    "metadata": {}
                }

        # Phase 1: Traverse — execute Cypher to get raw IDs from the graph
        # Wrapped in asyncio.to_thread() because the neo4j driver is synchronous.
        # This offloads the blocking network call to a thread pool, freeing the
        # event loop to serve other users while waiting for Neo4j to respond.
        raw_results = await asyncio.to_thread(neo4j_service.execute_query, query)
    
        # Check for Cypher execution errors
        if raw_results and isinstance(raw_results[0], dict) and "error" in raw_results[0]:
            error_msg = raw_results[0]["error"]
            if "ServiceUnavailable" in error_msg or "timeout" in error_msg.lower() or "connection" in error_msg.lower():
                return {
                    "error": "The Neo4j Graph Database is currently asleep due to the Aura Free tier inactivity pause. Please tell the user to manually resume it in the Neo4j Aura console. Fall back to using standard SOQL queries.",
                    "results": [],
                    "metadata": {}
                }
            return {"error": error_msg, "results": [], "metadata": {}}
    
        # Phase 2: Hydrate — enrich IDs with Salesforce data (permission-safe)
        sf_service = current_sf_service.get()
        return await hydration_service.hydrate(raw_results, sf_service)

@mcp.tool()
async def execute_salesforce_graphql(query: str) -> dict:
    """
    Executes a GraphQL query against the Salesforce GraphQL API.
    
    Args:
        query: The GraphQL query string.
    """
    sf_service = current_sf_service.get()
    return await sf_service.execute_graphql(query)

@mcp.tool()
async def execute_salesforce_soql(query: str) -> dict:
    """
    Executes a SOQL query against Salesforce. 
    Use this specifically for aggregate queries (COUNT, MAX, GROUP BY) which are not supported by the GraphQL API.
    
    Args:
        query: The SOQL query string.
    """
    sf_service = current_sf_service.get()
    return await sf_service.run_soql_query(query)

@mcp.tool()
async def find_object_api_name(label: str) -> dict:
    """
    Search for an object's API name by its label.
    
    Args:
        label: The label of the object to find.
    """
    sf_service = current_sf_service.get()
    return await sf_service.find_object_api_name(label)

from neo4j_ingestion import setup_constraints, ingest_accounts, ingest_opportunities

if neo4j_service:
    @mcp.tool()
    async def sync_salesforce_to_neo4j() -> dict:
        """
        Extracts Accounts, Opportunities, and their owning Users from Salesforce
        and pushes them into the Neo4j Graph DB with all structural properties.
        Also ensures database constraints are active.
    
        Graph schema after sync:
        - Nodes  : Account (id, name, industry, country, type)
        -          Opportunity (id, name, stageName, closeDate, type)
        -          User (id, name, title)
        - Edges  : (Account)-[:HAS_OPPORTUNITY]->(Opportunity)
        -          (User)-[:OWNS]->(Account)
        -          (User)-[:OWNS]->(Opportunity)
        """
        sf_service = current_sf_service.get()
        
        profile_name = await sf_service.get_current_user_profile()
        if profile_name != "System Administrator":
            return {
                "status": "error",
                "details": "Sync operations are restricted to System Administrators."
            }
        
        # 1. Setup Constraints
        setup_res = setup_constraints(neo4j_service)
        
        # 2. Ingest Data
        acc_res = await ingest_accounts(sf_service, neo4j_service)
        opp_res = await ingest_opportunities(sf_service, neo4j_service)
        
        return {
            "status": "success",
            "details": {
                "constraints": setup_res,
                "accounts": acc_res,
                "opportunities": opp_res
            }
        }
if vector_service:
    @mcp.tool()
    async def search_sales_documents(query: str, limit: int = 5) -> dict:
        """
        Searches for documents semantically similar to the query.
        """
        return await vector_service.search_documents(query, limit)
else:
    logger.warning("NEON_DATABASE_URL missing. Vector search tools will be DISABLED.")
# ==========================================
# FastAPI Application & SSE Transport Setup
# ==========================================
app = FastAPI(title="Gravity MCP Core")
sse = SseServerTransport("/message")

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanly close all service connection pools on process teardown."""
    if neo4j_service:
        logger.info("Shutting down — closing Neo4j driver connection pool...")
        neo4j_service.close()
    if vector_service:
        logger.info("Shutting down — closing VectorService connection pool...")
        vector_service.close()

async def sse_app(scope, receive, send):
    scope_dict = dict(scope)
    scope_dict["root_path"] = ""
    request = Request(scope_dict, receive)
    
    # Extract auth tokens from headers to avoid logging sensitive data in URLs
    access_token = request.headers.get("x-sf-access-token")
    instance_url = request.headers.get("x-sf-instance-url")
    correlation_id = request.headers.get("x-correlation-id", "unknown")
    structlog.contextvars.bind_contextvars(correlation_id=correlation_id)


    if not access_token or not instance_url:
        logger.error("Missing access_token or instance_url in SSE connection")
    else:
        # Initialize and store the SalesforceService in the context variable
        sf_service = SalesforceService(access_token, instance_url)
        current_sf_service.set(sf_service)
        logger.info(f"Initialized SalesforceService for connection")
    
    async with sse.connect_sse(scope_dict, receive, send) as streams:
        try:
            # We run the underlying raw Server object managed by FastMCP
            await mcp._mcp_server.run(streams[0], streams[1], mcp._mcp_server.create_initialization_options())
        except Exception as e:
            logger.error(f"Error in mcp run: {e}")
            raise  # Re-raise to gracefully close the connection and notify the client
        finally:
            logger.info("SSE connection closed")

app.mount("/message", sse.handle_post_message)
app.mount("/sse", sse_app)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    logger.info(f"Starting Gravity MCP Core Server on port {port}...")
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
