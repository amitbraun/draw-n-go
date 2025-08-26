"""Start or end a game for a session.

POST:
- Start: { sessionId, painter: username }
- End:   { sessionId, endGame: true, gameId: string, results: object }

Creates/updates Game and Session table entities, and persists a Scores row on end.
"""

import azure.functions as func
from azure.data.tables import TableClient
import json
import uuid
import os
from datetime import datetime

def main(req: func.HttpRequest) -> func.HttpResponse:
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
        end_game = data.get("endGame", False)
        if not session_id:
            return func.HttpResponse(json.dumps({"error": "Missing sessionId"}), status_code=400, headers={**cors_headers, "Content-Type": "application/json"})

        connection_string = os.getenv("AzureWebJobsStorage")
        if not connection_string:
            return func.HttpResponse(json.dumps({"error": "Missing AzureWebJobsStorage"}), status_code=500, headers={**cors_headers, "Content-Type": "application/json"})

        try:
            session_table = TableClient.from_connection_string(connection_string, table_name="Sessions")
            games_table = TableClient.from_connection_string(connection_string, table_name="Games")
        except Exception as e:
            return func.HttpResponse(json.dumps({"error": f"Table connection failed: {str(e)}"}), status_code=500, headers={**cors_headers, "Content-Type": "application/json"})

        try:
            session = session_table.get_entity(partition_key="session", row_key=session_id)
        except Exception as e:
            return func.HttpResponse(json.dumps({"error": f"Session not found: {str(e)}"}), status_code=404, headers={**cors_headers, "Content-Type": "application/json"})

        if end_game:
            # Allow client to provide gameId explicitly (painter upload after admin ends)
            game_id = session.get("currentGameId") or data.get("gameId")
            if game_id:
                try:
                    game = games_table.get_entity(partition_key="game", row_key=game_id)
                    # Persist optional results payload if provided by client
                    try:
                        results = data.get("results")
                    except Exception:
                        results = None
                    if results is not None:
                        try:
                            game["results"] = json.dumps(results)
                            team = results.get("team") if isinstance(results, dict) else None
                            if team and isinstance(team, dict):
                                if "adjustedPct" in team: game["teamAccuracy"] = float(team.get("adjustedPct"))
                                if "accuracyPct" in team: game["teamF1"] = float(team.get("accuracyPct"))
                        except Exception as e:
                            # If results can't be serialized, still complete the game
                            pass
                    # Mark game completed and stamp end time
                    end_iso = datetime.utcnow().isoformat() + "Z"
                    game["status"] = "completed"
                    game["timeCompleted"] = end_iso
                    games_table.update_entity(game, mode="merge")

                    # Persist a Scores row for hi-scores/personal history
                    try:
                        scores_table = TableClient.from_connection_string(connection_string, table_name="Scores")
                        try:
                            scores_table.create_table()
                        except Exception:
                            pass

                        # Compute duration
                        duration_sec = None
                        try:
                            t0_iso = game.get("timeStarted")
                            if t0_iso:
                                ts = t0_iso.rstrip("Z")
                                te = end_iso.rstrip("Z")
                                t0 = datetime.fromisoformat(ts)
                                t1 = datetime.fromisoformat(te)
                                duration_sec = int((t1 - t0).total_seconds())
                        except Exception:
                            duration_sec = None

                        # Build base entity
                        score_entity = {
                            "PartitionKey": "score",
                            "RowKey": str(game_id),
                            "gameId": str(game_id),
                            "sessionId": session_id,
                            "timeCompleted": end_iso,
                            **({"timePlayedSec": duration_sec} if duration_sec is not None else {}),
                            "templateId": session.get("templateId"),
                        }

                        # Attach template snapshot for future rendering (center, radius, zoom, vertices for polygon)
                        try:
                            if session.get("templateCenter"):
                                score_entity["templateCenter"] = session.get("templateCenter")  # already JSON string
                            if session.get("templateRadiusMeters") is not None:
                                score_entity["templateRadiusMeters"] = session.get("templateRadiusMeters")
                            if session.get("templateZoom") is not None:
                                score_entity["templateZoom"] = session.get("templateZoom")
                            if session.get("templateVertices"):
                                score_entity["templateVertices"] = session.get("templateVertices")  # JSON string of vertices
                        except Exception as e:
                            pass

                        # Attach totals from results.team
                        try:
                            team_res = results.get("team") if isinstance(results, dict) else None
                            if isinstance(team_res, dict):
                                if team_res.get("points") is not None:
                                    score_entity["finalScore"] = int(team_res.get("points"))
                                if team_res.get("adjustedPct") is not None:
                                    score_entity["totalAccuracy"] = float(team_res.get("adjustedPct"))
                        except Exception:
                            pass

                        # Players: role for each, and accuracy if Brush
                        try:
                            roles_map = {}
                            try:
                                roles_map = json.loads(game.get("roles", "{}") or "{}")
                            except Exception:
                                roles_map = {}
                            per_user = (results or {}).get("perUser") if isinstance(results, dict) else None
                            brush_acc = {}
                            if isinstance(per_user, list):
                                for entry in per_user:
                                    uname = entry.get("username")
                                    if uname and entry.get("adjustedPct") is not None:
                                        try:
                                            brush_acc[uname] = float(entry.get("adjustedPct"))
                                        except Exception:
                                            pass
                            players_list = []
                            for uname, role in roles_map.items():
                                players_list.append({
                                    "username": uname,
                                    "role": role,
                                    **({"accuracy": brush_acc.get(uname)} if role == "Brush" else {"accuracy": None})
                                })
                            score_entity["players"] = json.dumps(players_list)
                        except Exception as e:
                            pass

                        # Optional: attach compact drawing from results.trails (downsample and cap size)
                        try:
                            trails = None
                            if isinstance(results, dict):
                                trails = results.get("trails") or results.get("drawing") or None
                            if isinstance(trails, dict) and len(trails) > 0:
                                # Downsample each user's trail to at most 800 points and total under ~4000
                                def ds(arr, max_pts=800):
                                    try:
                                        n = len(arr)
                                        if n <= max_pts:
                                            return arr
                                        step = max(1, n // max_pts)
                                        return [arr[i] for i in range(0, n, step)][:max_pts]
                                    except Exception:
                                        return arr
                                compact = {}
                                total_pts = 0
                                for uname, pts in trails.items():
                                    if not isinstance(pts, list) or len(pts) == 0:
                                        continue
                                    # Normalize to {latitude, longitude}
                                    norm = []
                                    for p in pts:
                                        try:
                                            lat = p.get("latitude") if isinstance(p, dict) else None
                                            lng = p.get("longitude") if isinstance(p, dict) else None
                                            if lat is None and isinstance(p, dict) and "lat" in p:
                                                lat = p["lat"]
                                            if lng is None and isinstance(p, dict) and "lng" in p:
                                                lng = p["lng"]
                                            if lat is None or lng is None:
                                                continue
                                            norm.append({"latitude": float(lat), "longitude": float(lng)})
                                        except Exception:
                                            continue
                                    norm = ds(norm, 800)
                                    compact[uname] = norm
                                    total_pts += len(norm)
                                    if total_pts > 4000:
                                        break
                                if compact:
                                    score_entity["drawing"] = json.dumps({"trails": compact})
                                    score_entity["hasDrawing"] = True
                        except Exception as e:
                            pass

                        # Optional: attach friendly template name
                        try:
                            tpl_id = session.get("templateId")
                            if tpl_id:
                                templates_table = TableClient.from_connection_string(connection_string, table_name="Templates")
                                try:
                                    tdef = templates_table.get_entity(partition_key="template", row_key=tpl_id)
                                    if tdef.get("displayName"):
                                        score_entity["templateName"] = tdef.get("displayName")
                                except Exception:
                                    # If polygon isn't stored in Templates table, ignore
                                    pass
                        except Exception:
                            pass

                        try:
                            scores_table.upsert_entity(score_entity)
                        except Exception as e:
                            pass
                    except Exception as e:
                        pass
                except Exception as e:
                    # If updating the game fails, still reset the session state below
                    pass
                    # Continue to update session anyway

            session["isStarted"] = False
            session["currentGameId"] = None
            session["roles"] = None
            session["painter"] = None
            session_table.update_entity(session, mode="merge")
            return func.HttpResponse(
                json.dumps({"message": "Game ended", "gameId": game_id}),
                status_code=200,
                headers={**cors_headers, "Content-Type": "application/json"}
            )

        if session.get("isStarted", False):
            return func.HttpResponse(json.dumps({"error": "Session already started"}), status_code=400, headers={**cors_headers, "Content-Type": "application/json"})

        try:
            users = json.loads(session.get("users", "[]"))
        except Exception as e:
            return func.HttpResponse(json.dumps({"error": f"Corrupt users field: {str(e)}"}), status_code=500, headers={**cors_headers, "Content-Type": "application/json"})

        import random
        # Optional explicit painter selection
        requested_painter = data.get("painter")
        if requested_painter and requested_painter in users:
            painter = requested_painter
        else:
            painter = random.choice(users)

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
        try:
            games_table.create_entity(game_entity)
        except Exception as e:
            return func.HttpResponse(json.dumps({"error": f"Failed to create game entity: {str(e)}"}), status_code=500, headers={**cors_headers, "Content-Type": "application/json"})

        try:
            session["isStarted"] = True
            session["currentGameId"] = game_id
            session["roles"] = json.dumps(roles)
            session["painter"] = painter
            session_table.update_entity(session, mode="merge")
        except Exception as e:
            return func.HttpResponse(json.dumps({"error": f"Failed to update session entity: {str(e)}"}), status_code=500, headers={**cors_headers, "Content-Type": "application/json"})

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
        return func.HttpResponse(json.dumps({"error": f"Unhandled error: {str(e)}"}), status_code=500, headers={**cors_headers, "Content-Type": "application/json"})
    return func.HttpResponse("StartGame function is running", status_code=200)
