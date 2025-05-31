import azure.functions as func
from azure.data.tables import TableClient
import json
import uuid
import os
from datetime import datetime

def main(req: func.HttpRequest, signalRMessages: func.Out[func.SignalRMessage]) -> func.HttpResponse:
    cors_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*"
    }

    if req.method == "OPTIONS":
        return func.HttpResponse("", status_code=200, headers={**cors_headers, "Content-Type": "application/json"})

    try:
        data = req.get_json()
        session_id = data.get("sessionId")
        if not session_id:
            return func.HttpResponse(json.dumps({"error": "Missing sessionId"}), status_code=400, headers={**cors_headers, "Content-Type": "application/json"})

        connection_string = os.getenv("AzureWebJobsStorage")
        session_table = TableClient.from_connection_string(connection_string, table_name="Sessions")
        games_table = TableClient.from_connection_string(connection_string, table_name="Games")

        # Get session
        try:
            session = session_table.get_entity(partition_key="session", row_key=session_id)
        except Exception as e:
            return func.HttpResponse(json.dumps({"error": "Session not found"}), status_code=404, headers={**cors_headers, "Content-Type": "application/json"})

        if session.get("isStarted", False):
            return func.HttpResponse(json.dumps({"error": "Session already started"}), status_code=400, headers={**cors_headers, "Content-Type": "application/json"})

        users = json.loads(session.get("users", "[]"))
        # Assign roles: randomly pick a painter
        import random
        painter = random.choice(users)
        roles = {user: ("Painter" if user == painter else "Brush") for user in users}

        # Create game entity
        game_id = str(uuid.uuid4())
        game_entity = {
            "PartitionKey": "game",
            "RowKey": game_id,
            "sessionId": session_id,
            "players": json.dumps(users),
            "roles": json.dumps(roles),
            "timeStarted": datetime.utcnow().isoformat() + "Z",
            "shape": "N/A",
            "status": "in progress"
        }
        games_table.create_entity(game_entity)

        # Update session
        session["isStarted"] = True
        session["currentGameId"] = game_id
        session_table.update_entity(session, mode="merge")

        # Broadcast to all players in the session group
        signalRMessages.set(func.SignalRMessage(
            target="gameStarted",
            arguments=[{
                "sessionId": session_id,
                "gameId": game_id,
                "users": users,
                "painter": painter,
                "roles": roles
            }],
            groupName=session_id
        ))

        return func.HttpResponse(
            json.dumps({
                "message": "Game started",
                "gameId": game_id,
                "users": users,
                "painter": painter,
                "roles": roles
            }),
            status_code=200,
            headers={**cors_headers, "Content-Type": "application/json"}
        )

    except Exception as e:
        return func.HttpResponse(f"Error: {str(e)}", status_code=500, headers={**cors_headers, "Content-Type": "application/json"})
