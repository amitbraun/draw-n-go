import azure.functions as func
from azure.data.tables import TableClient
import os
import json


def main(req: func.HttpRequest) -> func.HttpResponse:
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Content-Type": "application/json"
    }

    if req.method == 'OPTIONS':
        return func.HttpResponse("", status_code=200, headers=headers)

    game_id = req.params.get('gameId')
    if not game_id:
        try:
            data = req.get_json()
            game_id = data.get('gameId')
        except Exception:
            game_id = None
    if not game_id:
        return func.HttpResponse(json.dumps({"error": "Missing gameId"}), status_code=400, headers=headers)

    try:
        connection_string = os.getenv("AzureWebJobsStorage")
        scores = TableClient.from_connection_string(connection_string, table_name="Scores")
        row = scores.get_entity(partition_key='score', row_key=str(game_id))
    except Exception as e:
        return func.HttpResponse(json.dumps({"error": "Not found"}), status_code=404, headers=headers)

    # Template snapshot
    template = {
        'templateId': row.get('templateId'),
        'center': None,
        'radiusMeters': row.get('templateRadiusMeters'),
        'zoomLevel': row.get('templateZoom'),
        'vertices': None,
    }
    try:
        tc = row.get('templateCenter')
        if tc:
            template['center'] = json.loads(tc) if isinstance(tc, str) else tc
    except Exception:
        pass
    try:
        tv = row.get('templateVertices')
        if tv:
            template['vertices'] = json.loads(tv) if isinstance(tv, str) else tv
    except Exception:
        pass

    trails = {}
    try:
        dr = row.get('drawing')
        if dr:
            d = json.loads(dr) if isinstance(dr, str) else dr
            if isinstance(d, dict) and isinstance(d.get('trails'), dict):
                trails = d['trails']
    except Exception:
        trails = {}

    return func.HttpResponse(
        json.dumps({ 'gameId': row.get('gameId') or row.get('RowKey'), 'template': template, 'trails': trails }),
        status_code=200,
        headers=headers
    )
