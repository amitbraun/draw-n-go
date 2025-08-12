import azure.functions as func
import logging
import os
from azure.data.tables import TableServiceClient
import json
import math
from datetime import datetime

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
    cors = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Cache-Control": "no-store"
    }
    if req.method == 'OPTIONS':
        return func.HttpResponse("", status_code=200, headers=cors)
    try:
        try:
            data = req.get_json()
        except ValueError:
            return func.HttpResponse("Invalid JSON", status_code=400, headers=cors)
        username = data.get("username")
        game_id = data.get("gameId")
        location = data.get("location") or {}
        if not (username and game_id and isinstance(location, dict)):
            return func.HttpResponse("Missing required fields", status_code=400, headers=cors)

        lat = location.get("latitude")
        lon = location.get("longitude")
        if lat is None or lon is None:
            return func.HttpResponse("Missing latitude/longitude", status_code=400, headers=cors)
        try:
            lat = float(lat); lon = float(lon)
        except Exception:
            return func.HttpResponse("Invalid latitude/longitude", status_code=400, headers=cors)

        if "timestamp" not in location:
            location["timestamp"] = int(datetime.utcnow().timestamp()*1000)
        location["latitude"] = lat
        location["longitude"] = lon

        connection_string = os.environ.get("AzureWebJobsStorage")
        if not connection_string:
            return func.HttpResponse("Storage connection string not found", status_code=500, headers=cors)
        table_service = TableServiceClient.from_connection_string(conn_str=connection_string)

        try:
            table_service.create_table("Distances")
        except Exception:
            pass
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
                total_distance = float(prev.get("totalDistance", 0.0))
                if all(k in prev_loc for k in ("latitude", "longitude")):
                    p_lat = float(prev_loc["latitude"])
                    p_lon = float(prev_loc["longitude"])
                    d = haversine(p_lat, p_lon, lat, lon)
                    if d >= 0.5:  # ignore tiny jitter
                        total_distance += d
            except Exception:
                logging.exception("Failed to parse previous entity; keeping existing totalDistance if possible")
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
        # sequence + lastUpdated for ordering/debug
        try:
            prev_seq = int(prev.get("seq")) if prev and prev.get("seq") is not None else -1
        except Exception:
            prev_seq = -1
        dist_entity["seq"] = prev_seq + 1
        dist_entity["lastUpdated"] = datetime.utcnow().isoformat() + "Z"

        try:
            dist_table.upsert_entity(dist_entity)
        except Exception:
            logging.exception("Failed to upsert Distances entity")
            return func.HttpResponse("Persist failed", status_code=500, headers=cors)

        return func.HttpResponse("OK", status_code=200, headers=cors)
    except Exception as e:
        logging.exception("Error in sendLocation")
        return func.HttpResponse(f"Error: {str(e)}", status_code=500, headers=cors)
