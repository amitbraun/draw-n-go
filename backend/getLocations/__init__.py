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
    table_name = "Locations"
    table_client = table_service.get_table_client(table_name)

    # Query all locations for the game
    entities = table_client.query_entities(f"PartitionKey eq '{game_id}'")
    locations = []
    for entity in entities:
        loc = json.loads(entity.get("location", "{}"))
        locations.append({
            "username": entity["RowKey"],
            "latitude": loc.get("latitude"),
            "longitude": loc.get("longitude"),
            "timestamp": loc.get("timestamp")
        })
    return func.HttpResponse(json.dumps(locations), mimetype="application/json")
