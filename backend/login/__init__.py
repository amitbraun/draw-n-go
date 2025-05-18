import azure.functions as func
from azure.data.tables import TableClient
import json
import hashlib
import os
import logging

def main(req: func.HttpRequest) -> func.HttpResponse:
    cors_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*"
    }

    if req.method == "OPTIONS":
        return func.HttpResponse("", status_code=200, headers=cors_headers)

    try:
        data = req.get_json()
        username = data.get("username")
        password = data.get("password")
        if not username or not password:
            return func.HttpResponse("Missing username or password", status_code=400, headers=cors_headers)
        connection_string = os.getenv('AzureWebJobsStorage')
        with TableClient.from_connection_string(connection_string, table_name="Users") as table:
            try:
                entity = table.get_entity(partition_key="user", row_key=username)
                hashed_input = hashlib.sha256(password.encode()).hexdigest()
                if entity["Password"] == hashed_input:
                    return func.HttpResponse("Login successful", status_code=200, headers=cors_headers)
                else:
                    return func.HttpResponse("Incorrect password", status_code=401, headers=cors_headers)
            except:
                return func.HttpResponse("User not found", status_code=404, headers=cors_headers)
    except Exception as e:
        print("--> Error:", str(e))
        return func.HttpResponse(f"Server error: {str(e)}", status_code=500, headers=cors_headers)

