import time
from app.services.processing import get_last_window
from app.services.detection import run_detection

while True:
    data = get_last_window(60)

    result = run_detection(data)

    # store the results in redis for the API to fetch later
#     {
    #     "id": "anomaly_101",
    #     "timestamp": 1710000000,

    #     "signals": ["temp", "flow", "pressure"],

    #     "confidence": 0.67,

    #     "correlation": [
    #         {"temp": "up", "flow": "down"}
    #     ],

    #     "severity": "critical",
    #     "score": 0.91,
    # }

    print("Pipeline result:", result)

    time.sleep(5)