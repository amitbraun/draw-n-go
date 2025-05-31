import azure.functions as func

def main(req: func.HttpRequest, signalRMessages: func.Out[func.SignalRMessage]) -> func.HttpResponse:
    data = req.get_json()
    # Broadcast to all clients in the session group
    signalRMessages.set(func.SignalRMessage(
        target="receiveLocation",
        arguments=[data.get("username"), data],
        groupName=data.get("sessionId")
    ))
    return func.HttpResponse("OK", status_code=200)
