import json
from fastapi import APIRouter, HTTPException
from app.core.redis import redis_get, redis_client

router = APIRouter()

@router.get("/detect")
async def get_detected_anomalies():
    """
    Fetches the LATEST pre-computed result from the background worker.
    This replaces the slow 'run_detection' call.
    """
    data = redis_get("anomaly:latest")
    if not data:
        return {"count": 0, "results": [], "message": "Worker is processing data..."}

    # Since the worker already merged signals and results, we just return it
    result_json = json.loads(data)
    return {
        "count": 1,
        "results": [result_json]
    }

@router.get("/incidents")
async def get_incidents():
    """
    Returns the HISTORY of anomalies from Redis.
    Each item in the list is an 'Incident' that the worker found.
    """
    # Grab all items from the 'anomaly:history' list
    history_strings = redis_client.lrange("anomaly:history", 0, -1)
    
    if not history_strings:
        return {"count": 0, "incidents": []}
        
    incidents = [json.loads(item) for item in history_strings]
    
    # These are already structured incidents from your model output
    return {
        "count": len(incidents),
        "incidents": incidents
    }

@router.get("/point")
async def get_point_anomalies():
    """Extracts just the Z-Score (Point) results from the latest Redis data."""
    data = redis_get("anomaly:latest")
    if not data: return {"results": []}
    
    full_result = json.loads(data)
    # Accessing the 'zscore' key from your model_outputs structure
    return {"results": full_result.get("model_outputs", {}).get("zscore", {})}

@router.get("/collective")
async def get_collective_anomalies():
    """Extracts just the IForest (Collective) results from Redis."""
    data = redis_get("anomaly:latest")
    if not data: return {"results": []}
    
    full_result = json.loads(data)
    return {"results": full_result.get("model_outputs", {}).get("iforest", {})}

@router.get("/contextual")
async def get_contextual_anomalies():
    """Extracts just the LSTM (Contextual) results from Redis."""
    data = redis_get("anomaly:latest")
    if not data: return {"results": []}
    
    full_result = json.loads(data)
    return {"results": full_result.get("model_outputs", {}).get("lstm", {})}

@router.get("/live")
async def get_live_status():
    """Quick check for the dashboard ensemble score."""
    score = redis_get("analytics:ensemble_score")
    return {
        "status": "online",
        "current_ensemble_score": float(score) if score else 0.0
    }