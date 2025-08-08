import azure.functions as func
from azure.data.tables import TableClient
import json
import os

def main(req: func.HttpRequest) -> func.HttpResponse:
    cors_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "*"
    }

    if req.method == "OPTIONS":
        return func.HttpResponse("", status_code=200, headers={**cors_headers, "Content-Type": "application/json"})

    try:
        connection_string = os.getenv("AzureWebJobsStorage")
        session_table = TableClient.from_connection_string(connection_string, table_name="Sessions")

        # === GET: Return session info ===
        if req.method == "GET":
            # --- PATCH: Try both params and route_params for sessionId ---
            session_id = req.params.get("sessionId") or (req.route_params.get("sessionId") if hasattr(req, "route_params") else None)
            if not session_id:
                return func.HttpResponse(json.dumps({"error": "Missing sessionId"}), status_code=400, headers={**cors_headers, "Content-Type": "application/json"})

            try:
                session = session_table.get_entity(partition_key="session", row_key=session_id)
            except Exception as e:            
                return func.HttpResponse(json.dumps({"error": f"Session not found: {str(e)}"}), status_code=404, headers={**cors_headers, "Content-Type": "application/json"})

            try:
                users = json.loads(session.get("users", "[]") or "[]")
            except Exception as e:
                return func.HttpResponse(json.dumps({"error": "Corrupt users field"}), status_code=500, headers={**cors_headers, "Content-Type": "application/json"})

            try:
                ready_status = json.loads(session.get("readyStatus", "{}") or "{}")
            except Exception as e:
                return func.HttpResponse(json.dumps({"error": "Corrupt readyStatus field"}), status_code=500, headers={**cors_headers, "Content-Type": "application/json"})

            return func.HttpResponse(
                json.dumps({
                    "users": users,
                    "readyStatus": ready_status,
                    "creator": session.get("creator", ""),
                    "isStarted": session.get("isStarted", False),
                    "currentGameId": session.get("currentGameId"),
                    "roles": json.loads(session.get("roles", "{}")) if session.get("roles") else {},
                    "painter": session.get("painter", ""),
                    "selectedShape": session.get("selectedShape")
                }),
                status_code=200,
                headers={**cors_headers, "Content-Type": "application/json"}
            )

        # === POST: Join / Ready / Leave ===
        elif req.method == "POST":
            username = req.headers.get("x-username")
            if not username:
                return func.HttpResponse(json.dumps({"error": "Missing x-username header"}), status_code=400, headers={**cors_headers, "Content-Type": "application/json"})

            data = req.get_json()
            session_id = data.get("sessionId")
            creator_username = data.get("creator")
            set_ready = data.get("setReady", False)
            leave = data.get("leave", False)
            new_selected_shape = data.get("selectedShape")

            # Resolve session
            session = None
            if session_id:
                try:
                    session = session_table.get_entity(partition_key="session", row_key=session_id)
                except:
                    return func.HttpResponse(json.dumps({"error": "Session not found"}), status_code=404, headers={**cors_headers, "Content-Type": "application/json"})
            elif creator_username:
                sessions = list(session_table.query_entities(
                    f"PartitionKey eq 'session' and creator eq '{creator_username}'"
                ))
                if not sessions:
                    return func.HttpResponse(json.dumps({"error": "No session found for that creator"}), status_code=404, headers={**cors_headers, "Content-Type": "application/json"})
                session = sessions[0]
                session_id = session["RowKey"]
            else:
                return func.HttpResponse(json.dumps({"error": "Missing sessionId or creator"}), status_code=400, headers={**cors_headers, "Content-Type": "application/json"})

            if session.get("isStarted", False):
                return func.HttpResponse(json.dumps({"error": "Session already started"}), status_code=403, headers={**cors_headers, "Content-Type": "application/json"})
            
            if "selectedShape" in data:
                session["selectedShape"] = data["selectedShape"]
                session_table.update_entity(session, mode="merge")
                return func.HttpResponse(json.dumps({"message": "Selected shape updated"}), status_code=200, headers={**cors_headers, "Content-Type": "application/json"})
            
            users = json.loads(session.get("users", "[]"))
            ready_status = json.loads(session.get("readyStatus", "{}"))

            # === Handle leave request ===
            if leave:
                if username not in users:
                    return func.HttpResponse(json.dumps({"error": "User not in session"}), status_code=400, headers={**cors_headers, "Content-Type": "application/json"})

                users.remove(username)
                ready_status.pop(username, None)

                # If the user leaving is the creator/admin, delete the session for everyone
                if username == session.get("creator"):
                    session_table.delete_entity(partition_key="session", row_key=session_id)
                    return func.HttpResponse(
                        json.dumps({ "message": "Session deleted by admin" }),
                        status_code=200,
                        headers={**cors_headers, "Content-Type": "application/json" }
                    )
                elif len(users) == 0:
                    session_table.delete_entity(partition_key="session", row_key=session_id)
                    return func.HttpResponse(
                        json.dumps({ "message": "Session deleted" }),
                        status_code=200,
                        headers={**cors_headers, "Content-Type": "application/json" }
                    )
                else:
                    session["users"] = json.dumps(users)
                    session["readyStatus"] = json.dumps(ready_status)
                    session_table.update_entity(session, mode="merge")
                    return func.HttpResponse(
                        json.dumps({ "message": "Left session", "sessionId": session_id }),
                        status_code=200,
                        headers={**cors_headers, "Content-Type": "application/json" }
                    )

            # === Handle join ===
            if username not in users:
                users.append(username)
                ready_status[username] = False

            # === Handle ready ===
            if "setReady" in data:
                ready_status[username] = bool(data["setReady"])

            session["users"] = json.dumps(users)
            session["readyStatus"] = json.dumps(ready_status)
            session_table.update_entity(session, mode="merge")
            
            # === Handle select shape ===
            if new_selected_shape is not None:
                if username == session.get("creator"):
                    session["selectedShape"] = new_selected_shape
                else:
                    return func.HttpResponse(json.dumps({"error": "Only creator can change selectedShape"}), status_code=403, headers={**cors_headers, "Content-Type": "application/json"})

            return func.HttpResponse(
                json.dumps({ "message": "Success", "sessionId": session_id }),
                status_code=200,
                headers={**cors_headers, "Content-Type": "application/json" }
            )

        else:
            return func.HttpResponse(json.dumps({"error": "Method not allowed"}), status_code=405, headers={**cors_headers, "Content-Type": "application/json"})

    except Exception as e:
        return func.HttpResponse(f"Error: {str(e)}", status_code=500, headers={**cors_headers, "Content-Type": "application/json"})
