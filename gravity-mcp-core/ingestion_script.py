import logging

from salesforce_service import SalesforceService
from neo4j_service import Neo4jService

logger = logging.getLogger("gravity_mcp.ingestion")

def ingest_accounts(sf_service: SalesforceService, neo4j_service: Neo4jService):
    """Syncs Account IDs into Neo4j. No business properties are stored (Index-Only architecture)."""
    logger.info("Fetching Account IDs from Salesforce...")
    
    soql = "SELECT Id FROM Account"
    sf_response = sf_service.run_soql_query(soql)
    accounts = sf_response.get("records", [])
    
    if not accounts:
        return {"success": False, "message": "No Accounts found or error occurred."}

    logger.info("Fetched %d Account IDs. Pushing to Neo4j...", len(accounts))
    
    cypher_query = """
    UNWIND $accounts AS row
    MERGE (a:Account {id: row.Id})
    ON CREATE SET a.createdAt = timestamp()
    SET a.updatedAt = timestamp()
    """
    
    neo4j_service.execute_query(cypher_query, {"accounts": accounts})
    return {"success": True, "message": f"Ingested {len(accounts)} Account IDs"}

def ingest_opportunities(sf_service: SalesforceService, neo4j_service: Neo4jService):
    """Syncs Opportunity IDs and Account relationships into Neo4j. No business properties are stored."""
    logger.info("Fetching Opportunity IDs from Salesforce...")
    
    soql = "SELECT Id, AccountId FROM Opportunity"
    sf_response = sf_service.run_soql_query(soql)
    opportunities = sf_response.get("records", [])
    
    if not opportunities:
        return {"success": False, "message": "No Opportunities found or error occurred."}

    logger.info("Fetched %d Opportunity IDs. Pushing to Neo4j...", len(opportunities))
    
    cypher_query = """
    UNWIND $opportunities AS row
    MERGE (o:Opportunity {id: row.Id})
    ON CREATE SET o.createdAt = timestamp()
    SET o.updatedAt = timestamp()
    
    WITH o, row
    WHERE row.AccountId IS NOT NULL
    MERGE (a:Account {id: row.AccountId})
    MERGE (a)-[:HAS_OPPORTUNITY]->(o)
    """
    
    neo4j_service.execute_query(cypher_query, {"opportunities": opportunities})
    return {"success": True, "message": f"Ingested {len(opportunities)} Opportunity IDs"}

def setup_constraints(neo4j_service: Neo4jService):
    logger.info("Setting up Neo4j Constraints...")
    queries = [
        "CREATE CONSTRAINT IF NOT EXISTS FOR (a:Account) REQUIRE a.id IS UNIQUE",
        "CREATE CONSTRAINT IF NOT EXISTS FOR (o:Opportunity) REQUIRE o.id IS UNIQUE"
    ]
    
    for query in queries:
        neo4j_service.execute_query(query)
    
    return {"success": True, "message": "Constraints verified"}
