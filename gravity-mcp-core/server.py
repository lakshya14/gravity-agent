import logging
from typing import Dict, Any
import uvicorn
from fastapi import FastAPI, Request
from contextvars import ContextVar
from mcp.server.fastmcp import FastMCP
from mcp.server.sse import SseServerTransport

from salesforce_service import SalesforceService

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gravity_mcp")

# Initialize the main FastMCP server
mcp = FastMCP(name="GravityCore")

# Context variable to hold the SalesforceService for the current request
current_sf_service: ContextVar[SalesforceService] = ContextVar("current_sf_service")

# Define tools using FastMCP
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

# ==========================================
# FastAPI Application & SSE Transport Setup
# ==========================================
app = FastAPI(title="Gravity MCP Core")
sse = SseServerTransport("/message")

async def sse_app(scope, receive, send):
    scope_dict = dict(scope)
    scope_dict["root_path"] = ""
    request = Request(scope_dict, receive)
    
    access_token = request.query_params.get("access_token")
    instance_url = request.query_params.get("instance_url")
    
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
    logger.info("Starting Gravity MCP Core Server on port 8000...")
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
