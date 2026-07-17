import logging
import requests
from typing import Dict, Any, Optional
from urllib.parse import quote

logger = logging.getLogger("gravity_mcp.salesforce")

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
        logger.info("Running SOQL: %s", query)
        
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
        logger.info("Updating %s %s with: %s", object_name, record_id, fields)
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
        logger.info("Running GraphQL query:\n%s", query)
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


    def find_object_api_name(self, label: str) -> Dict[str, Any]:
        """
        Searches the Salesforce Global Describe for an object with a matching label
        and returns its API name.
        """
        logger.info("Searching for object API name by label: %s", label)
        url = f"{self._get_base_url()}/sobjects/"
        
        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            
            data = response.json()
            sobjects = data.get("sobjects", [])
            
            # Case-insensitive search
            search_label = label.lower()
            
            for obj in sobjects:
                if obj.get("label", "").lower() == search_label or obj.get("labelPlural", "").lower() == search_label:
                    return {
                        "success": True,
                        "label": obj.get("label"),
                        "apiName": obj.get("name"),
                        "custom": obj.get("custom")
                    }
                    
            return {
                "success": False,
                "error": f"Could not find an object with label '{label}'"
            }
            
        except requests.exceptions.RequestException as error:
            return self._handle_api_error(f"search object label '{label}'", error, locals().get('response'))

    # Field definitions for JIT hydration (Index-Only Neo4j architecture).
    # When the HydrationService needs to enrich raw Salesforce IDs returned
    # by Neo4j, it uses these field lists to build batch SOQL queries.
    HYDRATION_FIELDS = {
        "Account": ["Id", "Name", "Industry", "Phone", "Type"],
        "Opportunity": ["Id", "Name", "StageName", "Amount", "CloseDate", "AccountId"],
    }

    def fetch_records_by_ids(self, object_name: str, record_ids: list[str]) -> Dict[str, Any]:
        """
        Fetches multiple records by their Salesforce IDs in a single SOQL query.
        
        Uses the current user's OAuth token, so Salesforce natively enforces
        Field-Level Security (FLS) and Object-Level Security (OLS).
        
        Args:
            object_name: The Salesforce object API name (e.g., 'Account').
            record_ids: A list of 18-character Salesforce record IDs.
            
        Returns:
            A dict with a 'records' key containing the fetched records, or
            a dict with 'error' and 'details' keys on failure.
        """
        if not record_ids:
            return {"records": []}
            
        fields = self.HYDRATION_FIELDS.get(object_name)
        if not fields:
            return {"error": f"No hydration field mapping defined for object: {object_name}"}
            
        field_list = ", ".join(fields)
        id_list = "', '".join(record_ids)
        query = f"SELECT {field_list} FROM {object_name} WHERE Id IN ('{id_list}')"
        
        logger.info("Hydrating %d %s records via SOQL", len(record_ids), object_name)
        return self.run_soql_query(query)

    def _handle_api_error(self, action: str, error: Exception, response: Optional[requests.Response] = None) -> Dict[str, Any]:
        """
        Centralized error handling for API requests.
        """
        logger.error("API Error during %s: %s", action, error)
        
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