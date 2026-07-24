import logging

from salesforce_service import SalesforceService
from neo4j_service import Neo4jService

logger = logging.getLogger("gravity_mcp.ingestion")


def setup_constraints(neo4j_service: Neo4jService):
    logger.info("Setting up Neo4j Constraints...")
    queries = [
        "CREATE CONSTRAINT IF NOT EXISTS FOR (a:Account) REQUIRE a.id IS UNIQUE",
        "CREATE CONSTRAINT IF NOT EXISTS FOR (o:Opportunity) REQUIRE o.id IS UNIQUE",
        "CREATE CONSTRAINT IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE",
    ]

    for query in queries:
        neo4j_service.execute_query(query)

    return {"success": True, "message": "Constraints verified"}


def ingest_accounts(sf_service: SalesforceService, neo4j_service: Neo4jService):
    """
    Syncs Accounts into Neo4j with structural (non-FLS-sensitive) properties
    and creates [:OWNS] edges from the owning User to each Account.

    Approved structural fields (safe to store — not FLS-gated or PII):
      Account : Id, Name, Industry, BillingCountry, Type
      Owner   : Name, Title  (business identity; not PII in a B2B CRM context)

    DO NOT add financial fields (AnnualRevenue) or PII (Email, Phone) here.
    Those remain JIT-hydrated from Salesforce via HydrationService.
    """
    logger.info("Fetching Account structural fields from Salesforce...")

    # OwnerId + Owner.Name/Title included for User node creation
    soql = "SELECT Id, Name, Industry, BillingCountry, Type, OwnerId, Owner.Name, Owner.Title FROM Account"
    sf_response = sf_service.run_soql_query(soql)
    accounts = sf_response.get("records", [])

    if not accounts:
        return {"success": False, "message": "No Accounts found or error occurred."}

    logger.info("Fetched %d Accounts. Pushing to Neo4j...", len(accounts))

    # Query 1: Upsert Account nodes with structural properties
    account_cypher = """
    UNWIND $accounts AS row
    MERGE (a:Account {id: row.Id})
    ON CREATE SET a.createdAt = timestamp()
    SET a.updatedAt  = timestamp(),
        a.name       = row.Name,
        a.industry   = row.Industry,
        a.country    = row.BillingCountry,
        a.type       = row.Type
    """
    neo4j_service.execute_query(account_cypher, {"accounts": accounts})

    # Query 2: Upsert User nodes and create [:OWNS]->(Account) edges.
    # Run after Query 1 so Account nodes are guaranteed to exist.
    user_account_cypher = """
    UNWIND $accounts AS row
    WITH row WHERE row.OwnerId IS NOT NULL
    MERGE (u:User {id: row.OwnerId})
    ON CREATE SET u.createdAt = timestamp()
    SET u.updatedAt = timestamp(),
        u.name      = row.Owner.Name,
        u.title     = row.Owner.Title
    WITH u, row
    MERGE (a:Account {id: row.Id})
    MERGE (u)-[:OWNS]->(a)
    """
    neo4j_service.execute_query(user_account_cypher, {"accounts": accounts})

    return {"success": True, "message": f"Ingested {len(accounts)} Accounts with structural properties and owner edges"}


def ingest_opportunities(sf_service: SalesforceService, neo4j_service: Neo4jService):
    """
    Syncs Opportunities into Neo4j with structural (non-FLS-sensitive) properties,
    [:HAS_OPPORTUNITY] edges from Accounts, and [:OWNS] edges from owning Users.

    Approved structural fields (safe to store — not FLS-gated or PII):
      Opportunity : Id, AccountId, Name, StageName, CloseDate, Type
      Owner       : Name, Title

    DO NOT add financial fields (Amount, ExpectedRevenue) or PII here.
    Those remain JIT-hydrated from Salesforce via HydrationService.
    """
    logger.info("Fetching Opportunity structural fields from Salesforce...")

    # OwnerId + Owner.Name/Title included for User node creation
    soql = "SELECT Id, AccountId, Name, StageName, CloseDate, Type, OwnerId, Owner.Name, Owner.Title FROM Opportunity"
    sf_response = sf_service.run_soql_query(soql)
    opportunities = sf_response.get("records", [])

    if not opportunities:
        return {"success": False, "message": "No Opportunities found or error occurred."}

    logger.info("Fetched %d Opportunities. Pushing to Neo4j...", len(opportunities))

    # Query 1: Upsert Opportunity nodes + [:HAS_OPPORTUNITY] edge from Account
    opportunity_cypher = """
    UNWIND $opportunities AS row
    MERGE (o:Opportunity {id: row.Id})
    ON CREATE SET o.createdAt = timestamp()
    SET o.updatedAt  = timestamp(),
        o.name       = row.Name,
        o.stageName  = row.StageName,
        o.closeDate  = row.CloseDate,
        o.type       = row.Type

    WITH o, row
    WHERE row.AccountId IS NOT NULL
    MERGE (a:Account {id: row.AccountId})
    MERGE (a)-[:HAS_OPPORTUNITY]->(o)
    """
    neo4j_service.execute_query(opportunity_cypher, {"opportunities": opportunities})

    # Query 2: Upsert User nodes and create [:OWNS]->(Opportunity) edges.
    # Run after Query 1 so Opportunity nodes are guaranteed to exist.
    user_opportunity_cypher = """
    UNWIND $opportunities AS row
    WITH row WHERE row.OwnerId IS NOT NULL
    MERGE (u:User {id: row.OwnerId})
    ON CREATE SET u.createdAt = timestamp()
    SET u.updatedAt = timestamp(),
        u.name      = row.Owner.Name,
        u.title     = row.Owner.Title
    WITH u, row
    MERGE (o:Opportunity {id: row.Id})
    MERGE (u)-[:OWNS]->(o)
    """
    neo4j_service.execute_query(user_opportunity_cypher, {"opportunities": opportunities})

    return {"success": True, "message": f"Ingested {len(opportunities)} Opportunities with structural properties and owner edges"}
