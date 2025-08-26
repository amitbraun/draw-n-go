"""Return latest per-user game locations from Distances table for a given gameId."""

import azure.functions as func
import os
from azure.data.tables import TableServiceClient
import json


def main(req: func.HttpRequest) -> func.HttpResponse:
    cors_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
    }
    if req.method == 'OPTIONS':
        return func.HttpResponse("", status_code=200, headers=cors_headers)

    game_id = req.params.get("gameId")
    if not game_id:
        try:
            req_body = req.get_json()
        except ValueError:
            req_body = {}
        game_id = req_body.get("gameId")
    if not game_id:
        return func.HttpResponse(json.dumps({"error": "Missing gameId"}), status_code=400, headers=cors_headers)

    connection_string = os.environ.get("AzureWebJobsStorage")
    if not connection_string:
        return func.HttpResponse(json.dumps({"error": "Storage connection string not found"}), status_code=500, headers=cors_headers)

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
            lat = loc.get("latitude")
            lon = loc.get("longitude")
            try:
                lat = float(lat) if lat is not None else None
            except Exception:
                lat = None
            try:
                lon = float(lon) if lon is not None else None
            except Exception:
                lon = None
            locations.append({
                "username": entity["RowKey"],
                "latitude": lat,
                "longitude": lon,
                "timestamp": loc.get("timestamp"),
                "totalDistance": float(entity.get("totalDistance", 0.0)),
            })
        return func.HttpResponse(json.dumps(locations), headers=cors_headers)
    except Exception as e:
        # Return empty list on failure to avoid breaking UI
        return func.HttpResponse(json.dumps([]), headers=cors_headers)
