import azure.functions as func
import json

# For now, return an empty default response structure
# { games: [] }

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
        return func.HttpResponse(json.dumps({ "games": [] }), status_code=200, headers=headers)
    except Exception as e:
        return func.HttpResponse(json.dumps({ "games": [] }), status_code=200, headers=headers)
