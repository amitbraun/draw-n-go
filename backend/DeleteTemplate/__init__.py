"""Delete a custom template by templateId (core templates are protected)."""

import azure.functions as func
from azure.data.tables import TableClient
import os, json

CORE_TEMPLATES = {"circle", "square", "star", "triangle"}

def main(req: func.HttpRequest) -> func.HttpResponse:
    cors = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Cache-Control": "no-store"
    }
    if req.method == 'OPTIONS':
        return func.HttpResponse("", status_code=200, headers=cors)
    template_id = (req.params.get('templateId') or '').strip()
    if not template_id:
        try:
            data = req.get_json()
            template_id = (data.get('templateId') or '').strip()
        except Exception:
            pass
    if not template_id:
        return func.HttpResponse(json.dumps({"error":"Missing templateId"}), status_code=400, headers={**cors, "Content-Type":"application/json"})
    if template_id in CORE_TEMPLATES:
        return func.HttpResponse(json.dumps({"error":"Core templates cannot be deleted"}), status_code=403, headers={**cors, "Content-Type":"application/json"})
    conn = os.getenv('AzureWebJobsStorage')
    if not conn:
        return func.HttpResponse(json.dumps({"error":"Missing AzureWebJobsStorage"}), status_code=500, headers={**cors, "Content-Type":"application/json"})
    table = TableClient.from_connection_string(conn, table_name="Templates")
    try:
        ent = table.get_entity(partition_key='template', row_key=template_id)
    except Exception:
        ent = None
    if not ent:
        return func.HttpResponse(json.dumps({"error":"Not found"}), status_code=404, headers={**cors, "Content-Type":"application/json"})
    # Only allow delete if flagged custom (backfill assumption: absence => non-custom for safety)
    if not ent.get('isCustom'):
        return func.HttpResponse(json.dumps({"error":"Template not deletable"}), status_code=403, headers={**cors, "Content-Type":"application/json"})
    try:
        table.delete_entity(partition_key='template', row_key=template_id)
    except Exception as e:
        return func.HttpResponse(json.dumps({"error":str(e)}), status_code=500, headers={**cors, "Content-Type":"application/json"})
    return func.HttpResponse(json.dumps({"message":"Deleted","templateId":template_id}), status_code=200, headers={**cors, "Content-Type":"application/json"})
