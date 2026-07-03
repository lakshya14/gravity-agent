import logging
from typing import Dict, Any

import uvicorn
from fastapi import FastAPI, Request, HTTPException
from mcp.server import Server
from mcp.server.sse import SseServerTransport
from mcp.types import Tool, TextContent, CallToolResult

from salesforce_service import SalesforceService

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("salesforce_mcp")

# Store active sessions (User's specific Salesforce connections)
active_sessions: Dict[str, SalesforceService] = {}

# Our global MCP Server instance
mcp = Server("salesforce-mcp-server")

@mcp.list_tools()
async def list_tools() -> list[Tool]:
    """Tells the MCP Client what tools are available."""
    return [
        Tool(
            name="run_soql_query",
            description="Run a SOQL query against Salesforce.",
            inputSchema={
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"]
            }
        ),
        Tool(
            name="find_object_api_name",
            description="Search for an object's API name by its label.",
            inputSchema={
                "type": "object",
                "properties": {"label": {"type": "string"}},
                "required": ["label"]
            }
        )
    ]

@mcp.call_tool()
async def call_tool(name: str, arguments: dict, context: Any = None) -> CallToolResult:
    """Executes the tool requested by the MCP Client."""
    # For now, we hardcode the session ID to map to our Nuxt Client's connection
    session_id = "default"
    
    sf_service = active_sessions.get(session_id)
    if not sf_service:
         return CallToolResult(
            isError=True,
            content=[TextContent(type="text", text="Error: No active Salesforce session found.")]
         )

    try:
        if name == "run_soql_query":
            result = sf_service.run_soql_query(arguments["query"])
            return CallToolResult(content=[TextContent(type="text", text=str(result))])
            
        elif name == "find_object_api_name":
            result = sf_service.find_object_api_name(arguments["label"])
            return CallToolResult(content=[TextContent(type="text", text=str(result))])
            
        else:
            return CallToolResult(isError=True, content=[TextContent(type="text", text="Unknown tool")])
            
    except Exception as e:
        logger.error(f"Error executing tool {name}: {e}")
        return CallToolResult(
            isError=True,
            content=[TextContent(type="text", text=f"Execution error: {str(e)}")]
        )


# ==========================================
# FastAPI Application & SSE Transport Setup
# ==========================================
app = FastAPI(title="Salesforce MCP Server")
sse_transports: Dict[str, SseServerTransport] = {}

@app.get("/sse")
async def sse_endpoint(request: Request, access_token: str, instance_url: str):
    """The MCP Client connects here first to establish the SSE stream."""
    transport = SseServerTransport("/message")
    
    async def handle_connection():
        session_id = "default"
        # We pass the token from the URL params into our SalesforceService
        active_sessions[session_id] = SalesforceService(access_token, instance_url)
        sse_transports[session_id] = transport
        
        logger.info(f"New SSE connection established: {session_id}")
        
        try:
            await mcp.run(transport, mcp.create_initialization_options())
        finally:
            logger.info(f"SSE connection closed: {session_id}")
            active_sessions.pop(session_id, None)
            sse_transports.pop(session_id, None)

    return await transport.handle_sse(request, handle_connection)

@app.post("/message")
async def message_endpoint(request: Request):
    """The MCP Client sends JSON-RPC execution commands here via HTTP POST."""
    session_id = "default"
    transport = sse_transports.get(session_id)
    if not transport:
        raise HTTPException(status_code=404, detail="Session not found")
        
    await transport.handle_post_message(request)

if __name__ == "__main__":
    logger.info("Starting Salesforce MCP Server on port 8000...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
