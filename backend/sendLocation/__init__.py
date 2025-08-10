import azure.functions as func
import logging
import os
from azure.data.tables import TableServiceClient
import json
import math

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        data = req.get_json()
        username = data.get("username")
        game_id = data.get("gameId")
        location = data.get("location")
        if not (username and game_id and location):
            return func.HttpResponse("Missing required fields", status_code=400)

        # Connect to Azure Table Storage
        connection_string = os.environ.get("AzureWebJobsStorage")
        if not connection_string:
            return func.HttpResponse("Storage connection string not found", status_code=500)
        table_service = TableServiceClient.from_connection_string(conn_str=connection_string)

        # Ensure Distances table exists
        try:
            table_service.create_table("Distances")
        except Exception:
            pass

        # Update Distances table with accumulated total distance only (no legacy Locations)
        dist_table = table_service.get_table_client("Distances")
        prev = None
        try:
            prev = dist_table.get_entity(game_id, username)
        except Exception:
            prev = None

        total_distance = 0.0
        if prev is not None:
            try:
                prev_loc = json.loads(prev.get("location", "{}"))
                if all(k in prev_loc for k in ("latitude", "longitude")) and all(k in location for k in ("latitude", "longitude")):
                    total_distance = float(prev.get("totalDistance", 0.0))
                    total_distance += haversine(prev_loc["latitude"], prev_loc["longitude"], location["latitude"], location["longitude"])
            except Exception:
                try:
                    total_distance = float(prev.get("totalDistance", 0.0))
                except Exception:
                    total_distance = 0.0

        dist_entity = {
            "PartitionKey": game_id,
            "RowKey": username,
            "location": json.dumps(location),
            "totalDistance": total_distance,
        }
        dist_table.upsert_entity(dist_entity)

        return func.HttpResponse("OK", status_code=200)
    except Exception as e:
        logging.exception("Error in sendLocation")
        return func.HttpResponse(f"Error: {str(e)}", status_code=500)
