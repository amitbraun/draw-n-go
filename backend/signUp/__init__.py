"""Create a new user record in the Users table with a hashed password.

POST body: { username, password }
Returns 201 on success; 409 if username already exists.
"""

import azure.functions as func
from azure.data.tables import TableClient
import hashlib
import os
import json
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
                # Check if user exists
                table.get_entity(partition_key="user", row_key=username)
                return func.HttpResponse("Username already exists", status_code=409, headers=cors_headers)
            except:
                hashed_password = hashlib.sha256(password.encode()).hexdigest()
                table.create_entity({
                    "PartitionKey": "user",
                    "RowKey": username,
                    "Password": hashed_password
                })
                return func.HttpResponse("Signup successful", status_code=201, headers=cors_headers)

    except Exception as e:
        logging.exception("signup failed")
        return func.HttpResponse(f"Server error: {str(e)}", status_code=500, headers=cors_headers)
