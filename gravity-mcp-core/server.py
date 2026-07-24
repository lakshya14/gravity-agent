import os
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

if not all([neo4j_uri, neo4j_username, neo4j_password]):
    missing = [var for var, val in {
        "NEO4J_URI": neo4j_uri,
        "NEO4J_USERNAME": neo4j_username,
        "NEO4J_PASSWORD": neo4j_password,
    }.items() if not val]
    raise EnvironmentError(f"Missing required Neo4j environment variables: {', '.join(missing)}")

neo4j_service = Neo4jService(
    uri=neo4j_uri,
    username=neo4j_username,
    password=neo4j_password
)

hydration_service = HydrationService()

# Define tools using FastMCP
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
    # Phase 1: Traverse — execute Cypher to get raw IDs from the graph
    raw_results = neo4j_service.execute_query(query)

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
    return hydration_service.hydrate(raw_results, sf_service)

@mcp.tool()
async def execute_salesforce_graphql(query: str) -> dict:
    """
    Executes a GraphQL query against the Salesforce GraphQL API.
    
    Args:
        query: The GraphQL query string.
    """
    sf_service = current_sf_service.get()
    return sf_service.execute_graphql(query)

@mcp.tool()
async def execute_salesforce_soql(query: str) -> dict:
    """
    Executes a SOQL query against Salesforce. 
    Use this specifically for aggregate queries (COUNT, MAX, GROUP BY) which are not supported by the GraphQL API.
    
    Args:
        query: The SOQL query string.
    """
    sf_service = current_sf_service.get()
    return sf_service.run_soql_query(query)

@mcp.tool()
async def find_object_api_name(label: str) -> dict:
    """
    Search for an object's API name by its label.
    
    Args:
        label: The label of the object to find.
    """
    sf_service = current_sf_service.get()
    return sf_service.find_object_api_name(label)

from neo4j_ingestion import setup_constraints, ingest_accounts, ingest_opportunities

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
    
    # 1. Setup Constraints
    setup_res = setup_constraints(neo4j_service)
    
    # 2. Ingest Data
    acc_res = ingest_accounts(sf_service, neo4j_service)
    opp_res = ingest_opportunities(sf_service, neo4j_service)
    
    return {
        "status": "success",
        "details": {
            "constraints": setup_res,
            "accounts": acc_res,
            "opportunities": opp_res
        }
    }
@mcp.tool()
def search_sales_documents(query: str, limit: int = 5) -> dict:
    """
    Searches for documents semantically similar to the query.
    """
    vector_service = VectorService()
    return vector_service.search_documents(query, limit)
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
    """Cleanly close the Neo4j driver's connection pool on process teardown."""
    logger.info("Shutting down — closing Neo4j driver connection pool...")
    neo4j_service.close()

async def sse_app(scope, receive, send):
    scope_dict = dict(scope)
    scope_dict["root_path"] = ""
    request = Request(scope_dict, receive)
    
    access_token = request.query_params.get("access_token")
    instance_url = request.query_params.get("instance_url")
    correlation_id = request.query_params.get("correlation_id", 'unknown')
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
        finally:
            logger.info("SSE connection closed")

app.mount("/message", sse.handle_post_message)
app.mount("/sse", sse_app)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    logger.info(f"Starting Gravity MCP Core Server on port {port}...")
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
