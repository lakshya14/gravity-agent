import logging
import os
from neo4j import GraphDatabase
from typing import Dict, Any, List, Optional

logger = logging.getLogger("gravity_mcp.neo4j")

class Neo4jService:
    """
    Handles direct communication with the Neo4j AuraDB instance.
    """
    
    def __init__(self, uri: str, username: str, password: str):
        self.driver = GraphDatabase.driver(uri, auth=(username, password), connection_timeout=5.0)
        
    def close(self):
        """Closes the driver connection."""
        self.driver.close()
        
    def execute_query(self, query: str, parameters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Executes a Cypher query against the Graph Database.
        """
        if parameters is None:
            parameters = {}
            
        logger.info(f"Running Cypher:\n{query}\nwith params: {parameters}")
        
        try:
            records, summary, keys = self.driver.execute_query(
                query,
                parameters,
            )
            
            # record.data() converts the Neo4j objects into a standard Python dict
            return [record.data() for record in records]
            
        except Exception as error:
            logger.exception("Failed to execute Cypher query.")
            return [{"error": str(error)}]

