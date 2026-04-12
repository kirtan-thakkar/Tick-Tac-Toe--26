"""
Logs Route - Returns system and backend events

Provides real-time event logs from:
- Worker analysis pipeline
- Anomaly detection events
- Data ingestion errors
- Model inference stats

Response format:
{
    "logs": [
        { "time": "2024-04-12T10:35:42Z", "msg": "Anomaly detected: ensemble_score=0.72", "type": "anomaly" },
        { "time": "2024-04-12T10:35:41Z", "msg": "Model inference completed in 234ms", "type": "inference" },
        { "time": "2024-04-12T10:35:40Z", "msg": "Ingested 50 sensor records from InfluxDB", "type": "data" },
    ]
}
"""

from fastapi import APIRouter, Query
from app.core.redis import redis_client, redis_get
from datetime import datetime
from typing import Optional
import json

router = APIRouter()

# --- Event Log Management ---
# In production, these would be stored in a dedicated log aggregator (ELK, Loki, etc.)
# For now, we'll use Redis lists to maintain a rolling window of events

def log_event(event_type: str, message: str):
    """
    Log a system event to Redis.
    
    Args:
        event_type: "anomaly" | "inference" | "data" | "error" | "system"
        message: Human-readable event description
    """
    timestamp = datetime.now().isoformat()
    event = {
        "time": timestamp,
        "msg": message,
        "type": event_type,
    }
    
    event_json = json.dumps(event)
    
    # Push to logs list and keep only last 500 entries
    redis_client.lpush("system:logs", event_json)
    redis_client.ltrim("system:logs", 0, 499)


@router.get("/logs/system")
async def get_system_logs(
    limit: int = Query(50, ge=1, le=500, description="Number of logs to return"),
    event_type: Optional[str] = Query(None, description="Filter by type: anomaly|inference|data|error|system"),
):
    """
    Returns recent system event logs.
    
    Query Parameters:
    - limit: Number of logs to return (default 50, max 500)
    - event_type: Filter by event type ("anomaly", "inference", "data", "error", "system")
    
    Response:
    {
        "logs": [
            { "time": "2024-04-12T10:35:42Z", "msg": "Anomaly detected...", "type": "anomaly" },
            { "time": "2024-04-12T10:35:41Z", "msg": "Model inference...", "type": "inference" },
        ],
        "count": 2
    }
    """
    
    # Get logs from Redis
    log_strings = redis_client.lrange("system:logs", 0, limit - 1)
    
    if not log_strings:
        # Generate synthetic logs for demo if none exist
        return generate_demo_logs(limit, event_type)
    
    # Parse and filter
    logs = []
    for log_str in log_strings:
        try:
            log_data = json.loads(log_str)
            
            # Apply type filter if specified
            if event_type and log_data.get("type") != event_type:
                continue
            
            logs.append(log_data)
        except:
            continue
    
    return {
        "logs": logs,
        "count": len(logs),
    }


def generate_demo_logs(limit: int, event_type: Optional[str]):
    """
    Generate demo logs if system hasn't logged yet.
    This ensures the endpoint always returns realistic data.
    """
    from datetime import datetime, timedelta
    
    all_logs = [
        {"type": "anomaly", "msg": "Critical anomaly detected: ensemble_score=0.84 on sensors [21, 22, 23]"},
        {"type": "inference", "msg": "Z-Score model: is_anomaly=1, score=5.07"},
        {"type": "inference", "msg": "IForest model: is_anomaly=0, score=-0.14"},
        {"type": "inference", "msg": "LSTM model: is_anomaly=0, score=0.0"},
        {"type": "data", "msg": "Ingested 50 sensor records from InfluxDB (60s window)"},
        {"type": "anomaly", "msg": "Warning-level anomaly detected: ensemble_score=0.56"},
        {"type": "inference", "msg": "Pipeline execution time: 234ms"},
        {"type": "system", "msg": "Worker analysis cycle completed successfully"},
        {"type": "data", "msg": "Redis cache updated: anomaly:latest, analytics:ensemble_score"},
        {"type": "inference", "msg": "Model ensemble voting: 1 model flagged anomaly (1/3 agreement)"},
        {"type": "anomaly", "msg": "Info-level anomaly detected: ensemble_score=0.32"},
        {"type": "system", "msg": "Anomaly history pruned to 50 most recent incidents"},
    ]
    
    # Filter by type if specified
    if event_type:
        all_logs = [log for log in all_logs if log["type"] == event_type]
    
    # Limit
    all_logs = all_logs[:limit]
    
    # Add timestamps
    now = datetime.now()
    for i, log in enumerate(all_logs):
        log_time = now - timedelta(seconds=i * 10)
        log["time"] = log_time.isoformat()
    
    return {
        "logs": all_logs,
        "count": len(all_logs),
        "demo": True,  # Indicate these are demo logs
    }


# --- Helper to use in worker ---
# In /backend/app/workers/worker.py, add these calls:
# log_event("data", f"Ingested {len(df)} records from InfluxDB")
# log_event("inference", f"Pipeline execution time: {elapsed_ms}ms")
# log_event("anomaly", f"Anomaly detected: score={result['ensemble_score']}, severity={result['severity']}")
