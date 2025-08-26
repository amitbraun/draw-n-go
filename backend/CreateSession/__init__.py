"""Create a new multiplayer session and register the creator as the first user."""

import azure.functions as func
from azure.data.tables import TableClient
import json
import uuid
import os

def main(req: func.HttpRequest) -> func.HttpResponse:
    cors_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*"
    }

    if req.method == "OPTIONS":
        return func.HttpResponse("", status_code=200, headers=cors_headers)

    try:
        username = req.headers.get("x-username")
        if not username:
            return func.HttpResponse("Missing x-username header", status_code=400, headers=cors_headers)

        session_id = str(uuid.uuid4())
        connection_string = os.getenv("AzureWebJobsStorage")
        session_table = TableClient.from_connection_string(connection_string, table_name="Sessions")

        entity = {
            "PartitionKey": "session",
            "RowKey": session_id,
            "creator": username,
            "users": json.dumps([username]),
            "readyStatus": json.dumps({username: False}),
            "isStarted": False,
            "currentGameId": None
        }

        session_table.create_entity(entity)

        return func.HttpResponse(
            json.dumps({ "sessionId": session_id }),
            status_code=201,
            headers={**cors_headers, "Content-Type": "application/json"}
        )

    except Exception as e:
        return func.HttpResponse(f"Error: {str(e)}", status_code=500, headers=cors_headers)
