import azure.functions as func
from azure.data.tables import TableClient
import json
import uuid
import os
from datetime import datetime

def main(req: func.HttpRequest) -> func.HttpResponse:
    print("DEBUG: StartGame function triggered")
    cors_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*"
    }

    if req.method == "OPTIONS":
        print("DEBUG: OPTIONS request received")
        return func.HttpResponse("", status_code=200, headers={**cors_headers, "Content-Type": "application/json"})

    try:
        print("DEBUG: Parsing request JSON")
        data = req.get_json()
        print(f"DEBUG: Request data: {data}")
        session_id = data.get("sessionId")
        end_game = data.get("endGame", False)
        if not session_id:
            print("DEBUG: Missing sessionId in request")
            return func.HttpResponse(json.dumps({"error": "Missing sessionId"}), status_code=400, headers={**cors_headers, "Content-Type": "application/json"})

        print("DEBUG: Getting AzureWebJobsStorage connection string")
        connection_string = os.getenv("AzureWebJobsStorage")
        if not connection_string:
            print("DEBUG: Missing AzureWebJobsStorage environment variable")
            return func.HttpResponse(json.dumps({"error": "Missing AzureWebJobsStorage"}), status_code=500, headers={**cors_headers, "Content-Type": "application/json"})

        print("DEBUG: Connecting to Sessions table")
        try:
            session_table = TableClient.from_connection_string(connection_string, table_name="Sessions")
            print("DEBUG: Connecting to Games table")
            games_table = TableClient.from_connection_string(connection_string, table_name="Games")
        except Exception as e:
            print(f"DEBUG: Table connection failed: {str(e)}")
            return func.HttpResponse(json.dumps({"error": f"Table connection failed: {str(e)}"}), status_code=500, headers={**cors_headers, "Content-Type": "application/json"})

        print("DEBUG: Fetching session entity")
        try:
            session = session_table.get_entity(partition_key="session", row_key=session_id)
        except Exception as e:
            print(f"DEBUG: Session not found: {str(e)}")
            return func.HttpResponse(json.dumps({"error": f"Session not found: {str(e)}"}), status_code=404, headers={**cors_headers, "Content-Type": "application/json"})

        if end_game:
            print("DEBUG: Ending game")
            game_id = session.get("currentGameId")
            if game_id:
                try:
                    game = games_table.get_entity(partition_key="game", row_key=game_id)
                    game["status"] = "completed"
                    games_table.update_entity(game, mode="merge")
                except Exception as e:
                    print(f"DEBUG: Failed to update game entity: {str(e)}")
                    # Continue to update session anyway

            session["isStarted"] = False
            session["currentGameId"] = None
            session["roles"] = None
            session["painter"] = None
            session_table.update_entity(session, mode="merge")
            print("DEBUG: Game ended and session updated")
            return func.HttpResponse(
                json.dumps({"message": "Game ended"}),
                status_code=200,
                headers={**cors_headers, "Content-Type": "application/json"}
            )

        if session.get("isStarted", False):
            print("DEBUG: Session already started")
            return func.HttpResponse(json.dumps({"error": "Session already started"}), status_code=400, headers={**cors_headers, "Content-Type": "application/json"})

        print("DEBUG: Loading users from session entity")
        try:
            users = json.loads(session.get("users", "[]"))
        except Exception as e:
            print(f"DEBUG: Corrupt users field: {str(e)}")
            return func.HttpResponse(json.dumps({"error": f"Corrupt users field: {str(e)}"}), status_code=500, headers={**cors_headers, "Content-Type": "application/json"})

        import random
        # Optional explicit painter selection
        requested_painter = data.get("painter")
        if requested_painter and requested_painter in users:
            painter = requested_painter
            print(f"DEBUG: Using requested painter: {painter}")
        else:
            painter = random.choice(users)
            print(f"DEBUG: Selected random painter: {painter}")

        roles = {user: ("Painter" if user == painter else "Brush") for user in users}

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
        print("DEBUG: Creating game entity")
        try:
            games_table.create_entity(game_entity)
        except Exception as e:
            print(f"DEBUG: Failed to create game entity: {str(e)}")
            return func.HttpResponse(json.dumps({"error": f"Failed to create game entity: {str(e)}"}), status_code=500, headers={**cors_headers, "Content-Type": "application/json"})

        print("DEBUG: Updating session entity")
        try:
            session["isStarted"] = True
            session["currentGameId"] = game_id
            session["roles"] = json.dumps(roles)
            session["painter"] = painter
            session_table.update_entity(session, mode="merge")
        except Exception as e:
            print(f"DEBUG: Failed to update session entity: {str(e)}")
            return func.HttpResponse(json.dumps({"error": f"Failed to update session entity: {str(e)}"}), status_code=500, headers={**cors_headers, "Content-Type": "application/json"})

        print("DEBUG: Game started successfully")
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
        print(f"DEBUG: Unhandled error: {str(e)}")
        return func.HttpResponse(json.dumps({"error": f"Unhandled error: {str(e)}"}), status_code=500, headers={**cors_headers, "Content-Type": "application/json"})
    return func.HttpResponse("StartGame function is running", status_code=200)
