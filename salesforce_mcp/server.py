
from mcp.server.fastmcp import FastMCP
from salesforce_service import SalesforceService

# Initialize the main FastMCP server for Salesforce Integrations
mcp = FastMCP(name="SalesforceMCP")

@mcp.tool()
async def execute_salesforce_graphql(query: str, access_token: str, instance_url: str) -> dict:
    """
    Executes a GraphQL query against the Salesforce GraphQL API.
    
    Args:
        query: The GraphQL query string.
        access_token: The Salesforce OAuth access token.
        instance_url: The Salesforce instance URL.
    """
    service = SalesforceService(access_token, instance_url)
    return service.execute_graphql(query)

@mcp.tool()
async def execute_salesforce_soql(query: str, access_token: str, instance_url: str) -> dict:
    """
    Executes a SOQL query against Salesforce. 
    Use this specifically for aggregate queries (COUNT, MAX, GROUP BY) which are not supported by the GraphQL API.
    
    Args:
        query: The SOQL query string.
        access_token: The Salesforce OAuth access token.
        instance_url: The Salesforce instance URL.
    """
    service = SalesforceService(access_token, instance_url)
    return service.run_soql_query(query)
