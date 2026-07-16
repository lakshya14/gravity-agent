import logging

from salesforce_service import SalesforceService
from neo4j_service import Neo4jService

logger = logging.getLogger("gravity_mcp.ingestion")

def ingest_accounts(sf_service: SalesforceService, neo4j_service: Neo4jService):
    logger.info("Fetching Accounts from Salesforce...")
    
    soql = "SELECT Id, Name, Industry FROM Account"
    sf_response = sf_service.run_soql_query(soql)
    accounts = sf_response.get("records", [])
    
    if not accounts:
        return {"success": False, "message": "No Accounts found or error occurred."}

    logger.info("Fetched %d Accounts. Pushing to Neo4j...", len(accounts))
    
    cypher_query = """
    UNWIND $accounts AS row
    MERGE (a:Account {id: row.Id})
    ON CREATE SET a.createdAt = timestamp()
    SET a.name = row.Name, 
        a.industry = row.Industry, 
        a.updatedAt = timestamp()
    """
    
    neo4j_service.execute_query(cypher_query, {"accounts": accounts})
    return {"success": True, "message": f"Ingested {len(accounts)} Accounts"}

def ingest_opportunities(sf_service: SalesforceService, neo4j_service: Neo4jService):
    logger.info("Fetching Opportunities from Salesforce...")
    
    soql = "SELECT Id, Name, Amount, StageName, AccountId FROM Opportunity"
    sf_response = sf_service.run_soql_query(soql)
    opportunities = sf_response.get("records", [])
    
    if not opportunities:
        return {"success": False, "message": "No Opportunities found or error occurred."}

    logger.info("Fetched %d Opportunities. Pushing to Neo4j...", len(opportunities))
    
    cypher_query = """
    UNWIND $opportunities AS row
    MERGE (o:Opportunity {id: row.Id})
    ON CREATE SET o.createdAt = timestamp()
    SET o.name = row.Name, 
        o.amount = row.Amount, 
        o.stage = row.StageName,
        o.updatedAt = timestamp()
    
    WITH o, row
    WHERE row.AccountId IS NOT NULL
    MERGE (a:Account {id: row.AccountId})
    MERGE (a)-[:HAS_OPPORTUNITY]->(o)
    """
    
    neo4j_service.execute_query(cypher_query, {"opportunities": opportunities})
    return {"success": True, "message": f"Ingested {len(opportunities)} Opportunities"}

def setup_constraints(neo4j_service: Neo4jService):
    logger.info("Setting up Neo4j Constraints...")
    queries = [
        "CREATE CONSTRAINT IF NOT EXISTS FOR (a:Account) REQUIRE a.id IS UNIQUE",
        "CREATE CONSTRAINT IF NOT EXISTS FOR (o:Opportunity) REQUIRE o.id IS UNIQUE"
    ]
    
    for query in queries:
        neo4j_service.execute_query(query)
    
    return {"success": True, "message": "Constraints verified"}
