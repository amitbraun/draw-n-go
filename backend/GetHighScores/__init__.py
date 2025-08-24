import azure.functions as func
from azure.data.tables import TableClient
import json
import os
from datetime import datetime


def parse_iso(ts: str):
    try:
        if not ts:
            return None
        return datetime.fromisoformat(ts.rstrip("Z"))
    except Exception:
        return None


def main(req: func.HttpRequest) -> func.HttpResponse:
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Content-Type": "application/json"
    }

    if req.method == 'OPTIONS':
        return func.HttpResponse("", status_code=200, headers=headers)

    try:
        template_id = req.params.get('templateId')
        page = int(req.params.get('page', '1') or '1')
        page_size = int(req.params.get('pageSize', '10') or '10')
        if page < 1:
            page = 1
        if page_size < 1 or page_size > 50:
            page_size = 10

        connection_string = os.getenv("AzureWebJobsStorage")
        scores_table = TableClient.from_connection_string(connection_string, table_name="Scores")

        rows = list(scores_table.query_entities("PartitionKey eq 'score'"))
        # Optional templates lookup for friendly names
        templates_table = None
        try:
            templates_table = TableClient.from_connection_string(connection_string, table_name="Templates")
        except Exception:
            templates_table = None
        items = []
        for r in rows:
            try:
                if template_id and r.get('templateId') != template_id:
                    continue
                time_completed = r.get('timeCompleted')
                dt = parse_iso(time_completed)
                date_str = dt.strftime('%Y-%m-%d %H:%M:%S') if dt else (time_completed or '')
                # Expand players
                players_raw = r.get('players')
                players = []
                if isinstance(players_raw, str):
                    try:
                        players = json.loads(players_raw)
                    except Exception:
                        players = []
                elif isinstance(players_raw, list):
                    players = players_raw
                # Friendly template name
                tpl_id = r.get('templateId')
                tpl_name = r.get('templateName') or tpl_id
                if not tpl_name and tpl_id:
                    try:
                        if templates_table is not None:
                            tdef = templates_table.get_entity(partition_key='template', row_key=tpl_id)
                            if tdef.get('displayName'):
                                tpl_name = tdef.get('displayName')
                    except Exception:
                        pass
                # Ensure polygon has a friendly name
                if tpl_id == 'polygon' and not tpl_name:
                    tpl_name = 'Polygon'

                items.append({
                    'gameId': r.get('gameId') or r.get('RowKey'),
                    'timeCompleted': time_completed,
                    'date': date_str,
                    'timePlayedSec': r.get('timePlayedSec'),
                    'templateId': tpl_id,
                    'templateName': tpl_name,
                    'finalScore': r.get('finalScore'),
                    'totalAccuracy': r.get('totalAccuracy'),
                    'players': players,
                    'hasDrawing': bool(r.get('drawing') or r.get('hasDrawing')),
                })
            except Exception:
                continue

        # Sort strictly by finalScore descending; entries without score go last
        def score_val(it):
            try:
                v = it.get('finalScore')
                if v is None:
                    return float('-inf')
                return float(v)
            except Exception:
                return float('-inf')
        items.sort(key=score_val, reverse=True)

        total = len(items)
        start = (page - 1) * page_size
        end = start + page_size
        page_items = items[start:end]

        return func.HttpResponse(
            json.dumps({ 'games': page_items, 'page': page, 'pageSize': page_size, 'total': total }),
            status_code=200,
            headers=headers
        )
    except Exception as e:
        return func.HttpResponse(json.dumps({ 'games': [], 'page': 1, 'pageSize': 10, 'total': 0 }), status_code=200, headers=headers)
