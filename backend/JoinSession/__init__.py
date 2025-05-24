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
        return func.HttpResponse("", status_code=200, headers=cors_headers)

    try:
        connection_string = os.getenv("AzureWebJobsStorage")
        session_table = TableClient.from_connection_string(connection_string, table_name="Sessions")

        # === GET: Return session info ===
        if req.method == "GET":
            session_id = req.params.get("sessionId")
            if not session_id:
                return func.HttpResponse("Missing sessionId", status_code=400, headers=cors_headers)

            try:
                session = session_table.get_entity(partition_key="session", row_key=session_id)
            except:
                return func.HttpResponse("Session not found", status_code=404, headers=cors_headers)

            try:
                users = json.loads(session.get("users", "[]") or "[]")
            except Exception as e:
                return func.HttpResponse("Corrupt users field", status_code=500, headers=cors_headers)

            try:
                ready_status = json.loads(session.get("readyStatus", "{}") or "{}")
            except Exception as e:
                return func.HttpResponse("Corrupt readyStatus field", status_code=500, headers=cors_headers)

            return func.HttpResponse(
                json.dumps({ "users": users, "readyStatus": ready_status }),
                status_code=200,
                headers={**cors_headers, "Content-Type": "application/json"}
            )

        # === POST: Join / Ready / Leave ===
        elif req.method == "POST":
            username = req.headers.get("x-username")
            if not username:
                return func.HttpResponse("Missing x-username header", status_code=400, headers=cors_headers)

            data = req.get_json()
            session_id = data.get("sessionId")
            creator_username = data.get("creator")
            set_ready = data.get("setReady", False)
            leave = data.get("leave", False)

            # Resolve session
            session = None
            if session_id:
                try:
                    session = session_table.get_entity(partition_key="session", row_key=session_id)
                except:
                    return func.HttpResponse("Session not found", status_code=404, headers=cors_headers)
            elif creator_username:
                sessions = list(session_table.query_entities(
                    f"PartitionKey eq 'session' and creator eq '{creator_username}'"
                ))
                if not sessions:
                    return func.HttpResponse("No session found for that creator", status_code=404, headers=cors_headers)
                session = sessions[0]
                session_id = session["RowKey"]
            else:
                return func.HttpResponse("Missing sessionId or creator", status_code=400, headers=cors_headers)

            if session.get("isStarted", False):
                return func.HttpResponse("Session already started", status_code=403, headers=cors_headers)

            users = json.loads(session.get("users", "[]"))
            ready_status = json.loads(session.get("readyStatus", "{}"))

            # === Handle leave request ===
            if leave:
                if username not in users:
                    return func.HttpResponse("User not in session", status_code=400, headers=cors_headers)

                users.remove(username)
                ready_status.pop(username, None)

                if len(users) == 0:
                    session_table.delete_entity(partition_key="session", row_key=session_id)
                    return func.HttpResponse(
                        json.dumps({ "message": "Session deleted" }),
                        status_code=200,
                        headers={**cors_headers, "Content-Type": "application/json" }
                    )
                else:
                    session["users"] = json.dumps(users)
                    session["readyStatus"] = json.dumps(ready_status)
                    session_table.update_entity(session, mode="Merge")
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
            if set_ready:
                ready_status[username] = True

            session["users"] = json.dumps(users)
            session["readyStatus"] = json.dumps(ready_status)
            session_table.update_entity(session, mode="Merge")

            return func.HttpResponse(
                json.dumps({ "message": "Success", "sessionId": session_id }),
                status_code=200,
                headers={**cors_headers, "Content-Type": "application/json" }
            )

        else:
            return func.HttpResponse("Method not allowed", status_code=405, headers=cors_headers)

    except Exception as e:
        return func.HttpResponse(f"Error: {str(e)}", status_code=500, headers=cors_headers)
