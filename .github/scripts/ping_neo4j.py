import os
import sys
from neo4j import GraphDatabase

def ping():
    uri = os.getenv("NEO4J_URI")
    username = os.getenv("NEO4J_USERNAME")
    password = os.getenv("NEO4J_PASSWORD")

    if not all([uri, username, password]):
        print("Missing Neo4j environment variables. Cannot ping.")
        sys.exit(1)

    print(f"Connecting to Neo4j at {uri}...")
    
    try:
        # Use a short timeout so the action doesn't hang forever if the DB is completely down
        driver = GraphDatabase.driver(uri, auth=(username, password), connection_timeout=10.0)
        
        # Execute a simple query to keep the database awake
        records, summary, keys = driver.execute_query("RETURN 1 AS alive")
        
        if records and records[0]["alive"] == 1:
            print("Successfully pinged Neo4j. Database is awake!")
            sys.exit(0)
        else:
            print("Ping returned unexpected result.")
            sys.exit(1)
            
    except Exception as e:
        print(f"Failed to ping Neo4j: {e}")
        sys.exit(1)
    finally:
        if 'driver' in locals():
            driver.close()

if __name__ == "__main__":
    ping()
