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
        username = req.params.get('username')
        page = int(req.params.get('page', '1') or '1')
        page_size = int(req.params.get('pageSize', '10') or '10')
        if page < 1:
            page = 1
        if page_size < 1 or page_size > 50:
            page_size = 10

        if not username:
            return func.HttpResponse(json.dumps({ "games": [], "page": page, "pageSize": page_size, "total": 0 }), status_code=200, headers=headers)

        connection_string = os.getenv("AzureWebJobsStorage")
        scores_table = TableClient.from_connection_string(connection_string, table_name="Scores")

        # Fetch all score rows (PartitionKey == 'score'), then filter by username in players JSON
        rows = list(scores_table.query_entities("PartitionKey eq 'score'"))
        items = []
        for r in rows:
            try:
                players_raw = r.get('players')
                players = []
                if isinstance(players_raw, str):
                    try:
                        players = json.loads(players_raw)
                    except Exception:
                        players = []
                elif isinstance(players_raw, list):
                    players = players_raw
                # Find this user
                found = None
                for p in players:
                    if p.get('username') == username:
                        found = p
                        break
                if not found:
                    continue

                time_completed = r.get('timeCompleted')
                # Normalize date display
                dt = parse_iso(time_completed)
                date_str = dt.strftime('%Y-%m-%d %H:%M:%S') if dt else (time_completed or '')

                item = {
                    'gameId': r.get('gameId') or r.get('RowKey'),
                    'timeCompleted': time_completed,
                    'date': date_str,
                    'timePlayedSec': r.get('timePlayedSec'),
                    'templateId': r.get('templateId'),
                    'templateName': r.get('templateName') or r.get('templateId'),
                    'finalScore': r.get('finalScore'),
                    'totalAccuracy': r.get('totalAccuracy'),
                    'role': found.get('role'),
                    'accuracy': found.get('accuracy'),
                }
                items.append(item)
            except Exception:
                continue

        # Sort by timeCompleted desc
        def sort_key(it):
            d = parse_iso(it.get('timeCompleted'))
            return d or datetime.min
        items.sort(key=sort_key, reverse=True)

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
        return func.HttpResponse(json.dumps({ "games": [], "page": 1, "pageSize": 10, "total": 0 }), status_code=200, headers=headers)
