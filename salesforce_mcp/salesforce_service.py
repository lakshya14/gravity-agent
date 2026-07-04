import requests
from typing import Dict, Any, Optional
from urllib.parse import quote

class SalesforceService:
    """
    Handles direct communication with the Salesforce REST API.
    
    This class is responsible for executing SOQL queries, fetching metadata,
    and modifying records. It relies on a pre-authenticated access token and
    instance URL passed from the MCP client.
    """
    
    def __init__(self, access_token: str, instance_url: str):
        self.access_token = access_token
        self.instance_url = instance_url
        self.headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
        self.api_version = "v60.0"

    def _get_base_url(self) -> str:
        """Returns the base REST API URL for the configured instance."""
        return f"{self.instance_url}/services/data/{self.api_version}"

    def run_soql_query(self, query: str) -> Dict[str, Any]:
        """Executes a SOQL query against Salesforce."""
        print(f"Running SOQL: {query}")
        
        encoded_query = quote(query)
        url = f"{self._get_base_url()}/query/?q={encoded_query}"
        
        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            
            data = response.json()
            return {"records": data.get("records", [])}
            
        except requests.exceptions.RequestException as error:
            return self._handle_api_error("execute query", error, locals().get('response'))

    def update_record(self, object_name: str, record_id: str, fields: Dict[str, Any]) -> Dict[str, Any]:
        """Updates a specific Salesforce record."""
        print(f"Updating {object_name} {record_id} with: {fields}")
        url = f"{self._get_base_url()}/sobjects/{object_name}/{record_id}"
        
        try:
            response = requests.patch(url, headers=self.headers, json=fields)
            response.raise_for_status()
            
            return {"success": True, "message": f"Successfully updated {object_name} {record_id}."}
            
        except requests.exceptions.RequestException as error:
            return self._handle_api_error(f"update {object_name}", error, locals().get('response'))

    def execute_graphql(self, query: str) -> Dict[str, Any]:
        """
        Executes a GraphQL query against the Salesforce GraphQL API.
        
        Args:
            query (str): The GraphQL query string.
            
        Returns:
            Dict: The JSON response containing the query results.
        """
        print(f"Running GraphQL query:\n{query}")
        url = f"{self._get_base_url()}/graphql"
        
        payload = {
            "query": query
        }
        
        try:
            response = requests.post(url, headers=self.headers, json=payload)
            response.raise_for_status()
            
            return response.json()
            
        except requests.exceptions.RequestException as error:
            return self._handle_api_error("execute GraphQL query", error, locals().get('response'))


    def _handle_api_error(self, action: str, error: Exception, response: Optional[requests.Response] = None) -> Dict[str, Any]:
        """
        Centralized error handling for API requests.
        """
        print(f"API Error during {action}: {error}")
        
        details = str(error)
        if response is not None:
            try:
                details = response.json()
            except ValueError:
                details = response.text
                
        return {
            "error": f"Failed to {action}",
            "details": details
        }