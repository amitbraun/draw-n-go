import azure.functions as func
from azure.data.tables import TableClient
import os
import json

def main(req: func.HttpRequest) -> func.HttpResponse:
    cors_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Cache-Control": "no-store"
    }

    if req.method == 'OPTIONS':
        return func.HttpResponse("", status_code=200, headers={**cors_headers, "Content-Type": "application/json"})

    try:
        connection_string = os.getenv("AzureWebJobsStorage")
        if not connection_string:
            return func.HttpResponse(json.dumps({"error": "Missing AzureWebJobsStorage"}), status_code=500, headers={**cors_headers, "Content-Type": "application/json"})

        table = TableClient.from_connection_string(connection_string, table_name="Templates")

        # We assume each row: PartitionKey='template', RowKey=templateId, optional fields
        try:
            entities = list(table.query_entities("PartitionKey eq 'template'"))
        except Exception:
            entities = []  # If table empty or filter fails return empty list gracefully

        items = []
        for e in entities:
            template_id = e.get("RowKey") or e.get("templateId")
            if not template_id:
                continue
            item = {
                "templateId": template_id,
                "displayName": e.get("displayName", template_id.capitalize()),
            }
            # Pass through stored normalized base vertices (array of {x,y}) if present
            if e.get("baseVertices"):
                try:
                    # Support either stored JSON string or native array
                    if isinstance(e.get("baseVertices"), str):
                        item["baseVertices"] = json.loads(e.get("baseVertices"))
                    else:
                        item["baseVertices"] = e.get("baseVertices")
                except Exception:
                    pass
            if e.get("pointCount") is not None:
                item["pointCount"] = e.get("pointCount")
            if e.get("innerRatio") is not None:
                item["innerRatio"] = e.get("innerRatio")
            if e.get("hasCustomVertices") is not None:
                item["hasCustomVertices"] = e.get("hasCustomVertices")
            items.append(item)

        return func.HttpResponse(json.dumps({"templates": items}), status_code=200, headers={**cors_headers, "Content-Type": "application/json"})
    except Exception as e:
        return func.HttpResponse(json.dumps({"error": str(e), "templates": []}), status_code=500, headers={**cors_headers, "Content-Type": "application/json"})
