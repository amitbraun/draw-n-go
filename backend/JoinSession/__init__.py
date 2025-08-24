import azure.functions as func
from azure.data.tables import TableClient
import json
import os
import math

def main(req: func.HttpRequest) -> func.HttpResponse:
    cors_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Cache-Control": "no-store"
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

            # Add template info if present
            template = None
            if session.get("templateId") and session.get("templateCenter") and session.get("templateRadiusMeters"):
                try:
                    center = json.loads(session["templateCenter"])
                except Exception:
                    center = session["templateCenter"]
                vertices = None
                if session.get("templateVertices"):
                    try:
                        vertices = json.loads(session["templateVertices"])
                    except Exception:
                        vertices = session["templateVertices"]
                template = {
                    "templateId": session["templateId"],
                    "center": center,
                    "radiusMeters": session["templateRadiusMeters"],
                    "zoomLevel": session.get("templateZoom"),
                    "vertices": vertices
                }
                # If we can, attach multiplier from Templates table
                try:
                    templates_table = TableClient.from_connection_string(connection_string, table_name="Templates")
                    tdef2 = templates_table.get_entity(partition_key="template", row_key=template["templateId"])
                    if tdef2.get("multiplier") is not None:
                        template["multiplier"] = float(tdef2.get("multiplier"))
                except Exception:
                    pass
                # Fallback: if polygon center missing but have vertices, compute centroid
                if template["templateId"] == 'polygon' and (not template.get("center") or 'lat' not in template['center']) and vertices:
                    try:
                        lats = [v['lat'] for v in vertices if 'lat' in v]
                        lngs = [v['lng'] for v in vertices if 'lng' in v]
                        if lats and lngs:
                            template['center'] = {
                                'lat': sum(lats)/len(lats),
                                'lng': sum(lngs)/len(lngs)
                            }
                    except Exception:
                        pass
                # Attach catalog definition (baseVertices) for non-polygon shapes so clients need not refetch or hardcode
                if template["templateId"] != 'polygon':
                    try:
                        templates_table = TableClient.from_connection_string(connection_string, table_name="Templates")
                        tdef = templates_table.get_entity(partition_key="template", row_key=template["templateId"])
                        base_vertices_raw = tdef.get("baseVertices")
                        base_vertices = None
                        if base_vertices_raw:
                            try:
                                if isinstance(base_vertices_raw, str):
                                    base_vertices = json.loads(base_vertices_raw)
                                else:
                                    base_vertices = base_vertices_raw
                            except Exception:
                                base_vertices = None
                        if base_vertices:
                            template["catalogDefinition"] = { "baseVertices": base_vertices }
                        # Also include difficulty multiplier if present
                        try:
                            if tdef.get("multiplier") is not None:
                                template["multiplier"] = float(tdef.get("multiplier"))
                        except Exception:
                            pass
                    except Exception:
                        pass
            # Include defaultCenter for non-admin initial map centering
            default_center = None
            if session.get("defaultCenter"):
                try:
                    default_center = json.loads(session["defaultCenter"])
                except Exception:
                    default_center = session["defaultCenter"]
            return func.HttpResponse(
                json.dumps({
                    "users": users,
                    "readyStatus": ready_status,
                    "creator": session.get("creator", ""),
                    "isStarted": session.get("isStarted", False),
                    "currentGameId": session.get("currentGameId"),
                    "roles": json.loads(session.get("roles", "{}")) if session.get("roles") else {},
                    "painter": session.get("painter", ""),
                    "template": template,
                    "defaultCenter": default_center
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
            set_template = data.get("setTemplate", False)
            set_default_center = data.get("setDefaultCenter", False)

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

            users = json.loads(session.get("users", "[]"))
            ready_status = json.loads(session.get("readyStatus", "{}"))

            # === Handle setDefaultCenter (admin only) ===
            if set_default_center:
                if username != session.get("creator"):
                    return func.HttpResponse(json.dumps({"error": "Only admin can set default center"}), status_code=403, headers={**cors_headers, "Content-Type": "application/json"})
                center = data.get("center")
                if not center or not isinstance(center, dict) or "latitude" not in center or "longitude" not in center:
                    return func.HttpResponse(json.dumps({"error": "Missing or invalid center {latitude, longitude}"}), status_code=400, headers={**cors_headers, "Content-Type": "application/json"})
                session["defaultCenter"] = json.dumps(center)
                session_table.update_entity(session, mode="merge")
                return func.HttpResponse(json.dumps({"message": "Default center set"}), status_code=200, headers={**cors_headers, "Content-Type": "application/json"})

            # === Handle setTemplate (admin only) ===
            if set_template:
                # Only admin can set template
                if username != session.get("creator"):
                    return func.HttpResponse(json.dumps({"error": "Only admin can set template"}), status_code=403, headers={**cors_headers, "Content-Type": "application/json"})
                template_id = data.get("templateId")
                center = data.get("center")
                radius = data.get("radiusMeters")
                zoom = data.get("zoomLevel")
                incoming_vertices = data.get("vertices")  # only for polygon from client
                if not (template_id and center and radius):
                    return func.HttpResponse(json.dumps({"error": "Missing templateId, center, or radiusMeters"}), status_code=400, headers={**cors_headers, "Content-Type": "application/json"})
                # Persist basics
                session["templateId"] = template_id
                session["templateCenter"] = json.dumps(center) if isinstance(center, dict) else center
                session["templateRadiusMeters"] = radius
                if zoom is not None:
                    session["templateZoom"] = zoom

                # Always store concrete vertices in session for all shapes so non-admins can consume immediately
                computed_vertices = None
                try:
                    if template_id == 'polygon':
                        # Use incoming vertices directly (validated basic type)
                        if incoming_vertices and isinstance(incoming_vertices, list) and len(incoming_vertices) >= 3:
                            computed_vertices = incoming_vertices
                    else:
                        # Lookup template definition for baseVertices
                        templates_table = TableClient.from_connection_string(connection_string, table_name="Templates")
                        try:
                            tdef = templates_table.get_entity(partition_key="template", row_key=template_id)
                            base_raw = tdef.get("baseVertices")
                            base_vertices = None
                            if base_raw:
                                if isinstance(base_raw, str):
                                    try:
                                        base_vertices = json.loads(base_raw)
                                    except Exception:
                                        base_vertices = None
                                elif isinstance(base_raw, list):
                                    base_vertices = base_raw
                            if base_vertices:
                                # Scale normalized base (x,y) by lat/lng deltas derived from radius
                                lat = center.get('lat') or center.get('latitude')
                                lng = center.get('lng') or center.get('longitude')
                                if lat is not None and lng is not None:
                                    d_lat = radius / 111320.0
                                    try:
                                        d_lng = radius / (111320.0 * math.cos(math.radians(lat)))
                                    except Exception:
                                        d_lng = radius / 111320.0
                                    scaled = []
                                    for p in base_vertices:
                                        x = p.get('x', 0)
                                        y = p.get('y', 0)
                                        scaled.append({
                                            'lat': lat + y * d_lat,
                                            'lng': lng + x * d_lng
                                        })
                                    if len(scaled) >= 3:
                                        computed_vertices = scaled
                        except Exception:
                            pass
                except Exception:
                    computed_vertices = None

                if computed_vertices:
                    session["templateVertices"] = json.dumps(computed_vertices)
                else:
                    session["templateVertices"] = None

                session_table.update_entity(session, mode="merge")
                return func.HttpResponse(json.dumps({"message": "Template set"}), status_code=200, headers={**cors_headers, "Content-Type": "application/json"})

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

            return func.HttpResponse(
                json.dumps({ "message": "Success", "sessionId": session_id }),
                status_code=200,
                headers={**cors_headers, "Content-Type": "application/json" }
            )

        else:
            return func.HttpResponse(json.dumps({"error": "Method not allowed"}), status_code=405, headers={**cors_headers, "Content-Type": "application/json"})

    except Exception as e:
        return func.HttpResponse(f"Error: {str(e)}", status_code=500, headers={**cors_headers, "Content-Type": "application/json"})
