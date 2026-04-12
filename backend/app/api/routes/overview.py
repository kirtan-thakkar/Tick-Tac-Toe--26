"""
Overview Route - Returns KPI metrics for the dashboard overview

Provides high-level metrics used by the Overview tab:
- Total active anomalies by severity
- System health percentage
- Renewables share breakdown

These values are computed from:
1. Anomaly history in Redis
2. Ingestion uptime metrics
3. Power generation mix (mock data)

Response format:
{
    "totalActiveAnomalies": 28,
    "critical": 4,
    "warning": 14,
    "info": 10,
    "systemHealthPercent": 97.8,
    "renewablesSharePercent": 57.4,
    "renewablesSplit": {
        "wind": 31,
        "solar": 22,
        "hydro": 4.4
    }
}
"""

from fastapi import APIRouter
from app.core.redis import redis_get, redis_client
import json
from datetime import datetime, timedelta

router = APIRouter()


def compute_anomaly_counts():
    """
    Analyze anomaly history to get count by severity.
    Returns: { "critical": int, "warning": int, "info": int }
    """
    history_strings = redis_client.lrange("anomaly:history", 0, -1)
    
    counts = {"critical": 0, "warning": 0, "info": 0}
    
    for item_str in history_strings:
        try:
            anomaly = json.loads(item_str)
            severity = str(anomaly.get("severity", "low")).lower()
            
            # Map to display severity
            if severity in ["critical", "high"]:
                counts["critical"] += 1
            elif severity in ["warning", "medium"]:
                counts["warning"] += 1
            else:
                counts["info"] += 1
                
        except:
            continue
    
    return counts


def compute_system_health() -> float:
    """
    Compute system health as a percentage.
    Factors:
    - Signal ingestion uptime (from Redis analytics)
    - Model inference success rate
    - Average ensemble confidence
    
    For now, use 97.8% as baseline + adjust based on latest anomaly score
    """
    base_health = 97.8
    
    # If there are recent critical anomalies, health dips slightly
    try:
        latest_anomaly = redis_get("anomaly:latest")
        if latest_anomaly:
            anomaly = json.loads(latest_anomaly)
            ensemble_score = float(anomaly.get("ensemble_score", 0.0))
            
            # If ensemble score is very high, system isn't "unhealthy" but alert score rises
            # Health = 100 - (max_anomaly_score * 2)
            health_deduction = min(ensemble_score * 2.0, 10.0)
            return max(85.0, base_health - health_deduction)
    except:
        pass
    
    return base_health


def get_renewable_mix() -> dict:
    """
    Returns current renewable energy mix breakdown.
    
    TODO: In production, query power generation source from SCADA/EMS
    For now, returns mock data that represents typical grid mix.
    """
    # Mock renewable mix
    # In production: query from your energy management system
    return {
        "wind": 31.0,
        "solar": 22.0,
        "hydro": 4.4,
    }


@router.get("/overview/metrics")
async def get_overview_metrics():
    """
    Returns aggregated KPI metrics for the Overview dashboard tab.
    
    Computed from:
    - Anomaly history (severity counts)
    - System ingestion uptime
    - Power generation mix
    
    Response:
    {
        "totalActiveAnomalies": 28,
        "critical": 4,
        "warning": 14,
        "info": 10,
        "systemHealthPercent": 97.8,
        "renewablesSharePercent": 57.4,
        "renewablesSplit": {
            "wind": 31,
            "solar": 22,
            "hydro": 4.4
        }
    }
    """
    
    # Get anomaly counts by severity
    severity_counts = compute_anomaly_counts()
    
    total_active = sum(severity_counts.values())
    
    # Compute system health percentage
    system_health = compute_system_health()
    
    # Get renewable mix
    renewable_mix = get_renewable_mix()
    renewables_share = sum(renewable_mix.values())
    
    return {
        "totalActiveAnomalies": total_active,
        "critical": severity_counts["critical"],
        "warning": severity_counts["warning"],
        "info": severity_counts["info"],
        "systemHealthPercent": round(system_health, 1),
        "renewablesSharePercent": renewables_share,
        "renewablesSplit": renewable_mix,
    }
