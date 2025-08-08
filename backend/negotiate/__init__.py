import azure.functions as func

def main(req: func.HttpRequest) -> func.HttpResponse:
    cors_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "*"
    }

    if req.method == "OPTIONS":
        return func.HttpResponse("", status_code=200, headers=cors_headers)

    # No SignalR support; return 404 for all other requests
    return func.HttpResponse(
        '{"error": "SignalR is not supported."}',
        mimetype="application/json",
        status_code=404,
        headers=cors_headers
    )