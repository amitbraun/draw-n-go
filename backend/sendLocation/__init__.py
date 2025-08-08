import azure.functions as func
import logging
import os
from azure.data.tables import TableServiceClient
import json

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
        table_name = "Locations"
        table_client = table_service.get_table_client(table_name)

        # Upsert entity (PartitionKey=gameId, RowKey=username)
        entity = {
            "PartitionKey": game_id,
            "RowKey": username,
            "location": json.dumps(location)
        }
        table_client.upsert_entity(entity)
        return func.HttpResponse("OK", status_code=200)
    except Exception as e:
        logging.exception("Error in sendLocation")
        return func.HttpResponse(f"Error: {str(e)}", status_code=500)
