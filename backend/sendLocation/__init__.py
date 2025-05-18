import azure.functions as func

def main(req: func.HttpRequest, signalRMessages: func.Out[func.SignalRMessage]) -> func.HttpResponse:
    data = req.get_json()
    signalRMessages.set(func.SignalRMessage(
        target="receiveLocation",
        arguments=[data.get("clientId"), data]
    ))
    return func.HttpResponse("OK", status_code=200)
