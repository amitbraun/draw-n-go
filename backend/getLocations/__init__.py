import azure.functions as func
import os
from azure.data.tables import TableServiceClient
import json


def main(req: func.HttpRequest) -> func.HttpResponse:
    game_id = req.params.get("gameId")
    if not game_id:
        try:
            req_body = req.get_json()
        except ValueError:
            req_body = {}
        game_id = req_body.get("gameId")
    if not game_id:
        return func.HttpResponse("Missing gameId", status_code=400)

    connection_string = os.environ.get("AzureWebJobsStorage")
    if not connection_string:
        return func.HttpResponse("Storage connection string not found", status_code=500)

    table_service = TableServiceClient.from_connection_string(conn_str=connection_string)

    # Only Distances table
    try:
        dist_table = table_service.get_table_client("Distances")
        entities = dist_table.query_entities(f"PartitionKey eq '{game_id}'")
        locations = []
        for entity in entities:
            try:
                loc = json.loads(entity.get("location", "{}"))
            except Exception:
                loc = {}
            locations.append({
                "username": entity["RowKey"],
                "latitude": loc.get("latitude"),
                "longitude": loc.get("longitude"),
                "timestamp": loc.get("timestamp"),
                "totalDistance": float(entity.get("totalDistance", 0.0)),
            })
        return func.HttpResponse(json.dumps(locations), mimetype="application/json")
    except Exception:
        return func.HttpResponse(json.dumps([]), mimetype="application/json")
