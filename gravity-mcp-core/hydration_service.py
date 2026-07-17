import logging
from typing import Any

from salesforce_service import SalesforceService

logger = logging.getLogger("gravity_mcp.hydration")


# Salesforce Record ID key prefixes used to classify raw IDs
# extracted from Neo4j traversal results by object type.
SALESFORCE_ID_PREFIXES = {
    "001": "Account",
    "006": "Opportunity",
}


class HydrationService:
    """
    Takes raw Neo4j traversal results (containing only Salesforce IDs),
    hydrates them via the Salesforce API using the current user's
    OAuth token, and returns permission-filtered, enriched results.

    This is the security gateway of the Index-Only Neo4j architecture:
    Salesforce enforces FLS/OLS on the hydration query, so any records
    the user cannot access are simply omitted from the response.
    """

    MAX_HYDRATION_BATCH = 50

    def hydrate(self, neo4j_results: list[dict[str, Any]], sf_service: SalesforceService) -> dict[str, Any]:
        """
        Orchestrates the full hydration pipeline:
        1. Extract & classify Salesforce IDs from Neo4j results.
        2. Apply short-circuit cap (MAX_HYDRATION_BATCH).
        3. Batch-fetch from Salesforce (FLS/OLS enforced by user's token).
        4. Merge hydrated properties back onto the result structure.
        5. Drop paths containing redacted (inaccessible) records.

        Returns:
            A dict with 'results' (hydrated records) and 'metadata'
            (total, hydrated, redacted_count, truncated_count).
        """
        if not neo4j_results:
            return self._empty_response()

        # Phase 1: Extract all unique Salesforce IDs, grouped by object type
        ids_by_type = self._extract_and_classify_ids(neo4j_results)
        total_unique_ids = sum(len(ids) for ids in ids_by_type.values())

        if total_unique_ids == 0:
            logger.warning("No Salesforce IDs found in Neo4j results. Returning raw results.")
            return {
                "results": neo4j_results,
                "metadata": {"total": len(neo4j_results), "hydrated": 0, "redacted_count": 0, "truncated_count": 0}
            }

        # Phase 2: Short-circuit — cap total IDs before hydrating
        truncated_count = 0
        if total_unique_ids > self.MAX_HYDRATION_BATCH:
            truncated_count = total_unique_ids - self.MAX_HYDRATION_BATCH
            ids_by_type = self._apply_cap(ids_by_type, self.MAX_HYDRATION_BATCH)
            logger.info("Short-circuit applied: capped at %d IDs, truncated %d", self.MAX_HYDRATION_BATCH, truncated_count)

        # Phase 3: Batch-fetch from Salesforce (permission-safe)
        hydrated_lookup = self._batch_fetch(ids_by_type, sf_service)

        # Phase 4: Merge hydrated data and compute redaction
        ids_requested = set()
        for ids in ids_by_type.values():
            ids_requested.update(ids)

        ids_returned = set(hydrated_lookup.keys())
        redacted_ids = ids_requested - ids_returned
        redacted_count = len(redacted_ids)

        if redacted_count > 0:
            logger.info("Permission filter: %d record(s) redacted by Salesforce FLS/OLS", redacted_count)

        # Phase 5: Build enriched results, dropping entries with redacted IDs
        enriched_results = self._merge_results(neo4j_results, hydrated_lookup, redacted_ids)

        return {
            "results": enriched_results,
            "metadata": {
                "total": len(neo4j_results),
                "hydrated": len(enriched_results),
                "redacted_count": redacted_count,
                "truncated_count": truncated_count,
            }
        }

    def _extract_and_classify_ids(self, results: list[dict]) -> dict[str, list[str]]:
        """
        Walks through Neo4j results and extracts all string values
        that match Salesforce ID patterns, classifying them by object type
        using the standard Salesforce key prefix convention.
        """
        ids_by_type: dict[str, set[str]] = {}

        for record in results:
            self._walk_and_collect(record, ids_by_type)

        return {obj_type: list(id_set) for obj_type, id_set in ids_by_type.items()}

    def _walk_and_collect(self, obj: Any, ids_by_type: dict[str, set[str]]) -> None:
        """Recursively walks a nested dict/list to find Salesforce ID strings."""
        if isinstance(obj, str) and self._is_salesforce_id(obj):
            prefix = obj[:3]
            object_type = SALESFORCE_ID_PREFIXES.get(prefix)
            if object_type:
                ids_by_type.setdefault(object_type, set()).add(obj)
        elif isinstance(obj, dict):
            for value in obj.values():
                self._walk_and_collect(value, ids_by_type)
        elif isinstance(obj, list):
            for item in obj:
                self._walk_and_collect(item, ids_by_type)

    @staticmethod
    def _is_salesforce_id(value: str) -> bool:
        """Checks if a string looks like a Salesforce 15 or 18-char record ID."""
        return len(value) in (15, 18) and value.isalnum() and value[:3] in SALESFORCE_ID_PREFIXES

    @staticmethod
    def _apply_cap(ids_by_type: dict[str, list[str]], cap: int) -> dict[str, list[str]]:
        """Trims the ID lists proportionally to fit within the cap."""
        capped: dict[str, list[str]] = {}
        remaining = cap

        for obj_type, ids in ids_by_type.items():
            take = min(len(ids), remaining)
            capped[obj_type] = ids[:take]
            remaining -= take
            if remaining <= 0:
                break

        return capped

    @staticmethod
    def _batch_fetch(ids_by_type: dict[str, list[str]], sf_service: SalesforceService) -> dict[str, dict]:
        """
        Calls SalesforceService.fetch_records_by_ids for each object type
        and builds a unified lookup dict keyed by Salesforce Record ID.
        """
        lookup: dict[str, dict] = {}

        for object_name, record_ids in ids_by_type.items():
            if not record_ids:
                continue

            response = sf_service.fetch_records_by_ids(object_name, record_ids)
            records = response.get("records", [])

            for record in records:
                record_id = record.get("Id")
                if record_id:
                    lookup[record_id] = record

        return lookup

    @staticmethod
    def _merge_results(
        neo4j_results: list[dict],
        hydrated_lookup: dict[str, dict],
        redacted_ids: set[str],
    ) -> list[dict]:
        """
        Merges hydrated Salesforce properties back onto Neo4j result rows.
        Drops any result row that references a redacted (inaccessible) ID.
        """
        enriched = []

        for row in neo4j_results:
            row_ids = set()
            HydrationService._collect_ids_from_row(row, row_ids)

            # Drop the entire row if it contains any redacted ID (broken-path policy)
            if row_ids & redacted_ids:
                continue

            enriched_row = HydrationService._enrich_row(row, hydrated_lookup)
            enriched.append(enriched_row)

        return enriched

    @staticmethod
    def _collect_ids_from_row(obj: Any, ids: set[str]) -> None:
        """Collects all Salesforce IDs from a single result row."""
        if isinstance(obj, str) and HydrationService._is_salesforce_id(obj):
            ids.add(obj)
        elif isinstance(obj, dict):
            for value in obj.values():
                HydrationService._collect_ids_from_row(value, ids)
        elif isinstance(obj, list):
            for item in obj:
                HydrationService._collect_ids_from_row(item, ids)

    @staticmethod
    def _enrich_row(obj: Any, lookup: dict[str, dict]) -> Any:
        """
        Recursively replaces raw Salesforce IDs with their hydrated record dicts.
        If an ID is found in the lookup, it's replaced with the full record.
        Nested dicts and lists are traversed recursively.
        """
        if isinstance(obj, str) and HydrationService._is_salesforce_id(obj):
            return lookup.get(obj, obj)
        elif isinstance(obj, dict):
            return {key: HydrationService._enrich_row(value, lookup) for key, value in obj.items()}
        elif isinstance(obj, list):
            return [HydrationService._enrich_row(item, lookup) for item in obj]
        return obj

    @staticmethod
    def _empty_response() -> dict[str, Any]:
        return {
            "results": [],
            "metadata": {"total": 0, "hydrated": 0, "redacted_count": 0, "truncated_count": 0}
        }
