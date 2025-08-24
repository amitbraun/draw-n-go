import azure.functions as func
from azure.data.tables import TableClient
import os
import json

"""HTTP POST CreateTemplate
Body: { templateId: str, baseVertices: [ {x,y}, ... ] }
Normalizes and stores baseVertices as JSON string in Templates table.
Rejects if templateId exists (to avoid overwrite) unless 'overwrite': true provided (future extension).
"""

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
        data = req.get_json()
    except Exception:
        return func.HttpResponse(json.dumps({"error":"Invalid JSON"}), status_code=400, headers={**cors, "Content-Type":"application/json"})

    template_id = (data.get('templateId') or '').strip()
    base_vertices = data.get('baseVertices')
    if not template_id or not base_vertices or not isinstance(base_vertices, list) or len(base_vertices) < 3:
        return func.HttpResponse(json.dumps({"error":"Missing templateId or insufficient baseVertices"}), status_code=400, headers={**cors, "Content-Type":"application/json"})
    if not all(isinstance(p, dict) and 'x' in p and 'y' in p for p in base_vertices):
        return func.HttpResponse(json.dumps({"error":"Vertices must be objects with x,y"}), status_code=400, headers={**cors, "Content-Type":"application/json"})

    # Basic name validation
    import re
    if not re.match(r'^[A-Za-z0-9_-]{2,40}$', template_id):
        return func.HttpResponse(json.dumps({"error":"Invalid templateId format"}), status_code=400, headers={**cors, "Content-Type":"application/json"})

    conn = os.getenv('AzureWebJobsStorage')
    if not conn:
        return func.HttpResponse(json.dumps({"error":"Missing AzureWebJobsStorage"}), status_code=500, headers={**cors, "Content-Type":"application/json"})

    table = TableClient.from_connection_string(conn, table_name="Templates")
    try:
        table.create_table()
    except Exception:
        pass

    # Check existing
    try:
        existing = table.get_entity(partition_key='template', row_key=template_id)
        if existing:
            return func.HttpResponse(json.dumps({"error":"Template already exists"}), status_code=409, headers={**cors, "Content-Type":"application/json"})
    except Exception:
        pass

    multiplier = data.get('multiplier')
    try:
        multiplier = float(multiplier) if multiplier is not None else None
        if multiplier is not None and multiplier <= 0:
            multiplier = None
    except Exception:
        multiplier = None

    entity = {
        'PartitionKey': 'template',
        'RowKey': template_id,
        'displayName': template_id.capitalize(),
        'baseVertices': json.dumps(base_vertices),
        'isCustom': True  # mark newly created templates as custom (deletable)
    }
    if multiplier is not None:
        entity['multiplier'] = multiplier
    try:
        table.create_entity(entity)
    except Exception as e:
        return func.HttpResponse(json.dumps({"error": str(e)}), status_code=500, headers={**cors, "Content-Type":"application/json"})

    return func.HttpResponse(json.dumps({"message":"Template created","templateId": template_id}), status_code=201, headers={**cors, "Content-Type":"application/json"})
