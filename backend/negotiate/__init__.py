import azure.functions as func
import os
import logging

def main(req: func.HttpRequest, connectionInfo: func.SignalRConnectionInfo) -> func.HttpResponse:
    cors_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "*"
    }

    if req.method == "OPTIONS":
        return func.HttpResponse("", status_code=200, headers=cors_headers)

    if not connectionInfo:
        return func.HttpResponse(
            '{"error": "SignalR connection info not available. Check AzureSignalRConnectionString app setting and SignalR resource health."}',
            mimetype="application/json",
            status_code=500,
            headers=cors_headers
        )

    return func.HttpResponse(
        connectionInfo.to_json(),
        mimetype="application/json",
        status_code=200,
        headers=cors_headers
    )