from fastapi import APIRouter, Query
from app.services.processing import get_last_window
from typing import Optional

router = APIRouter()

@router.get("/live")
async def get_live_signals(
    sensorId: Optional[str] = Query(None, description="Filter by specific sensor (e.g., 'sensor_0')"),
    window: Optional[int] = Query(60, ge=10, le=3600, description="Time window in seconds (10-3600)"),
):
    """
    Returns live telemetry data from the last N seconds.
    
    Query Parameters:
    - sensorId: Optional, filter to single sensor (e.g., "sensor_5")
    - window: Time window in seconds (default 60, range 10-3600)
    
    Response:
    {
        "count": 50,
        "data": [
            {
                "timestamp": "2024-04-12T10:30:45Z",
                "sensor_0": 0.5,
                "sensor_1": -0.2,
                ...
                "sensor_37": 0.1,
                "anomaly": null
            },
            ...
        ]
    }
    """
    
    # Fetch data from InfluxDB for the specified window
    data = get_last_window(window or 60)
    
    # If sensorId filter is specified, keep only that sensor + timestamp
    if sensorId:
        filtered_data = []
        for row in data:
            filtered_row = {
                "timestamp": row.get("timestamp"),
                sensorId: row.get(sensorId),
                "anomaly": row.get("anomaly"),
            }
            filtered_data.append(filtered_row)
        data = filtered_data
    
    return {
        "count": len(data),
        "data": data[:50],  # Limit response to 50 most recent points
        "window": window or 60,
        "sensorFilter": sensorId or "all",
    }


@router.get("/telemetry")
async def get_live_telemetry(
    sensor: Optional[str] = Query(None, description="Filter by sensor (e.g., 'node-alpha-1')"),
):
    """
    Returns live model anomaly detection scores for monitoring cards from Redis.
    """
    import json
    from app.core.redis import redis_get
    from datetime import datetime

    # Try to get the latest detection result from Redis
    latest_data = redis_get("anomaly:latest")

    if latest_data:
        try:
            result = json.loads(latest_data)
            model_outputs = result.get("model_outputs", {})

            # Return raw model scores from Redis without additional scaling.
            zscore = model_outputs.get("zscore", {}).get("score", 0)
            iforest = model_outputs.get("iforest", {}).get("score", 0)
            lstm = model_outputs.get("lstm", {}).get("score", 0)

            return {
                "zscore": round(float(zscore), 6),
                "isolation_forest": round(float(iforest), 6),
                "lstm": round(float(lstm), 6),
                "timestamp": result.get("timestamp", datetime.now().isoformat()),
                "sensor": sensor or "node-alpha-1",
                "is_anomaly": result.get("is_anomaly", False)
            }
        except Exception as e:
            print(f"Error parsing redis data: {e}")

    # Fallback to simulated data if Redis is empty or fails
    import random
    return {
        "zscore": round(random.uniform(0.01, 0.05), 3),
        "isolation_forest": round(random.uniform(0.01, 0.05), 3),
        "lstm": round(random.uniform(0.01, 0.05), 3),
        "timestamp": datetime.now().isoformat(),
        "sensor": sensor or "node-alpha-1",
        "is_anomaly": False,
        "note": "fallback_simulated"
    }