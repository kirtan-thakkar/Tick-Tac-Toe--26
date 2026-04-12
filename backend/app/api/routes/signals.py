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