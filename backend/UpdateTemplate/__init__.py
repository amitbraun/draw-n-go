import azure.functions as func
from azure.data.tables import TableClient
import os, json

"""Update editable properties for a template: multiplier and displayName."""

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
    if not template_id:
        return func.HttpResponse(json.dumps({"error":"Missing templateId"}), status_code=400, headers={**cors, "Content-Type":"application/json"})

    multiplier = data.get('multiplier')
    display_name = data.get('displayName')
    # Validate optional fields
    if multiplier is not None:
        try:
            if isinstance(multiplier, str):
                multiplier = multiplier.replace(',', '.').strip()
            multiplier = float(multiplier)
        except Exception:
            return func.HttpResponse(json.dumps({"error":"Invalid multiplier"}), status_code=400, headers={**cors, "Content-Type":"application/json"})
    if display_name is not None:
        display_name = str(display_name).strip()
        if not display_name:
            display_name = None

    conn = os.getenv('AzureWebJobsStorage')
    if not conn:
        return func.HttpResponse(json.dumps({"error":"Missing AzureWebJobsStorage"}), status_code=500, headers={**cors, "Content-Type":"application/json"})
    table = TableClient.from_connection_string(conn, table_name="Templates")
    try:
        ent = table.get_entity(partition_key='template', row_key=template_id)
    except Exception:
        return func.HttpResponse(json.dumps({"error":"Template not found"}), status_code=404, headers={**cors, "Content-Type":"application/json"})

    changed = False
    if multiplier is not None:
        ent['multiplier'] = multiplier
        changed = True
    if display_name is not None:
        ent['displayName'] = display_name
        changed = True
    if not changed:
        return func.HttpResponse(json.dumps({"message":"No changes"}), status_code=200, headers={**cors, "Content-Type":"application/json"})
    try:
        table.update_entity(ent, mode='merge')
    except Exception as e:
        return func.HttpResponse(json.dumps({"error":str(e)}), status_code=500, headers={**cors, "Content-Type":"application/json"})
    return func.HttpResponse(json.dumps({"message":"Updated","templateId":template_id}), status_code=200, headers={**cors, "Content-Type":"application/json"})
