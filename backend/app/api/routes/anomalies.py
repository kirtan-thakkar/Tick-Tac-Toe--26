import json
from fastapi import APIRouter, HTTPException, Query
from app.core.redis import redis_get, redis_client
from datetime import datetime
from typing import Optional

router = APIRouter()

# --- Helper Functions ---

def severity_to_order(severity: str) -> int:
    """Map severity string to sort order (lower = higher priority)"""
    order_map = {
        "critical": 0,
        "warning": 1,
        "info": 2,
    }
    return order_map.get(severity.lower(), 3)


def compute_incident_id(timestamp: int, asset_id: str) -> str:
    """Generate unique incident ID from timestamp and asset"""
    return f"INC-{int(timestamp)}-{asset_id[:3].upper()}"


def enrich_anomaly_as_incident(anomaly_data: dict) -> dict:
    """
    Convert raw anomaly detection result to frontend incident format
    
    Input (from model): { timestamp, ensemble_score, severity, affected_sensors, ... }
    Output (for dashboard): { id, title, severity, asset, status, timestamp, hypothesis, duration }
    """
    try:
        ts = anomaly_data.get("timestamp", int(datetime.now().timestamp()))
        severity = anomaly_data.get("severity", "info").lower()
        
        # Map severity numeric/string to display format
        if isinstance(severity, (int, float)):
            if severity > 0.7:
                display_severity = "Critical"
            elif severity > 0.4:
                display_severity = "Warning"
            else:
                display_severity = "Info"
        else:
            severity_map = {"critical": "Critical", "high": "Critical", 
                          "warning": "Warning", "medium": "Warning",
                          "info": "Info", "low": "Info"}
            display_severity = severity_map.get(str(severity).lower(), "Info")
        
        # Get affected sensors/asset
        affected_sensors = anomaly_data.get("affected_sensors", [])
        primary_asset = affected_sensors[0] if affected_sensors else "UNKNOWN"
        
        # Determine anomaly type for title
        anomaly_type = anomaly_data.get("anomaly_type", "collective")
        type_map = {
            "point": "Point anomaly detected",
            "collective": "Collective anomaly detected",
            "contextual": "Contextual anomaly detected",
        }
        title = type_map.get(anomaly_type, "Anomaly detected")
        
        # Generate hypothesis from model results
        model_outputs = anomaly_data.get("model_outputs", {})
        hypothesis = "Multiple model consensus detected anomalous behavior."
        if model_outputs.get("zscore", {}).get("is_anomaly"):
            hypothesis = "Point anomaly: extreme value deviation detected."
        elif model_outputs.get("iforest", {}).get("is_anomaly"):
            hypothesis = "Collective anomaly: unusual pattern in sensor correlation."
        elif model_outputs.get("lstm", {}).get("is_anomaly"):
            hypothesis = "Contextual anomaly: behavior deviates from historical patterns."
        
        return {
            "id": compute_incident_id(ts, primary_asset),
            "title": title,
            "severity": display_severity,
            "asset": primary_asset,
            "status": "Open",  # Default; can be overridden by operator feedback
            "timestamp": ts,
            "hypothesis": hypothesis,
            "duration": f"{datetime.fromtimestamp(ts).strftime('%H:%M:%S')}",
            "anomaly_score": float(anomaly_data.get("ensemble_score", 0)),
        }
    except Exception as e:
        print(f"Error enriching anomaly: {e}")
        return None

@router.get("/detect")
async def get_detected_anomalies():
    """
    Fetches the LATEST pre-computed result from the background worker.
    This replaces the slow 'run_detection' call.
    
    Ensures consistent response payload with:
    - anomaly_type
    - severity
    - ensemble_score
    - affected_sensors
    - timestamp
    """
    data = redis_get("anomaly:latest")
    if not data:
        return {
            "count": 0,
            "results": [],
            "message": "Worker is processing data..."
        }

    result_json = json.loads(data)
    
    # Ensure all required fields are present
    required_fields = {
        "timestamp": int(datetime.now().timestamp()),
        "anomaly_type": result_json.get("anomaly_type", "collective"),
        "severity": result_json.get("severity", "low"),
        "ensemble_score": float(result_json.get("ensemble_score", 0.0)),
        "affected_sensors": result_json.get("affected_sensors", []),
    }
    
    # Merge with original data
    normalized_result = {**result_json, **required_fields}
    
    return {
        "count": 1,
        "results": [normalized_result]
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


@router.get("/list")
async def get_anomalies_list(
    severity: Optional[str] = Query(None, description="Filter by severity: Critical|Warning|Info"),
    status: Optional[str] = Query(None, description="Filter by status: Open|Investigating|Resolved"),
    search: Optional[str] = Query(None, description="Text search in title/hypothesis"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
):
    """
    Returns a paginated, filterable list of anomaly incidents.
    
    Query Parameters:
    - severity: "Critical" | "Warning" | "Info" (case-insensitive)
    - status: "Open" | "Investigating" | "Resolved" (case-insensitive)
    - search: Text to search in title/hypothesis/asset
    - page: Page number (default 1)
    - limit: Items per page (default 20, max 100)
    
    Response:
    {
        "items": [
            {
                "id": "INC-1842",
                "title": "Transformer thermal anomaly",
                "severity": "Critical",
                "asset": "TX-AT-022",
                "status": "Investigating",
                "timestamp": 1704123456,
                "hypothesis": "Insulation breakdown leading to localized overheating.",
                "duration": "12m active"
            }
        ],
        "total": 42,
        "page": 1,
        "limit": 20,
        "pages": 3
    }
    """
    
    # Get all incidents from history
    history_strings = redis_client.lrange("anomaly:history", 0, -1)
    
    if not history_strings:
        return {
            "items": [],
            "total": 0,
            "page": page,
            "limit": limit,
            "pages": 0
        }
    
    # Parse and enrich all anomalies
    incidents = []
    for item_str in history_strings:
        try:
            anomaly_data = json.loads(item_str)
            incident = enrich_anomaly_as_incident(anomaly_data)
            if incident:
                incidents.append(incident)
        except:
            continue
    
    # Apply filters
    filtered = incidents
    
    if severity:
        severity_normalized = severity.capitalize()
        filtered = [inc for inc in filtered if inc["severity"] == severity_normalized]
    
    if status:
        status_normalized = status.capitalize()
        filtered = [inc for inc in filtered if inc["status"] == status_normalized]
    
    if search:
        search_lower = search.lower()
        filtered = [
            inc for inc in filtered
            if search_lower in inc["title"].lower()
            or search_lower in inc["hypothesis"].lower()
            or search_lower in inc["asset"].lower()
        ]
    
    # Sort by timestamp (newest first) then by severity
    filtered.sort(
        key=lambda x: (-x["timestamp"], severity_to_order(x["severity"]))
    )
    
    # Paginate
    total = len(filtered)
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    paginated = filtered[start_idx:end_idx]
    
    total_pages = (total + limit - 1) // limit
    
    return {
        "items": paginated,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": total_pages,
    }