"""
Assets Route - Returns registered assets with computed health metrics

This endpoint serves the Assets tab in the dashboard. Currently uses mock data
to demonstrate the structure. In production, this would query an asset registry DB.

Response format:
{
    "assets": [
        {
            "id": "TX-AT-022",
            "name": "Alpha Transformer Hub",
            "type": "Transformer",
            "health": "Critical|Degraded|Healthy",
            "location": "Substation A",
            "lastMaintenance": "2024-02-20",
            "uptime": "98.2%",
            "load": "89%"
        }
    ]
}
"""

from fastapi import APIRouter
from app.core.redis import redis_get
import json
from datetime import datetime, timedelta

router = APIRouter()

# --- Mock Asset Registry ---
# TODO: Replace with actual database queries in production
ASSET_REGISTRY = [
    {
        "id": "TX-AT-022",
        "name": "Alpha Transformer Hub",
        "type": "Transformer",
        "location": "Substation A",
        "installed": "2020-03-15",
        "nominal_capacity": 150,
        "current_load_pct": 89,
    },
    {
        "id": "FL-110-PL-003",
        "name": "Primary Feeder Line 3",
        "type": "Feeder",
        "location": "Sector 4",
        "installed": "2019-08-22",
        "nominal_capacity": 120,
        "current_load_pct": 75,
    },
    {
        "id": "SN-CZ-115",
        "name": "Thermal Probe Array",
        "type": "Sensor",
        "location": "Substation A",
        "installed": "2021-11-10",
        "nominal_capacity": 100,
        "current_load_pct": 25,
    },
    {
        "id": "BATT-ST-09",
        "name": "Backup Storage Unit 9",
        "type": "Battery",
        "location": "Sector 2",
        "installed": "2022-06-20",
        "nominal_capacity": 500,
        "current_load_pct": 42,
    },
    {
        "id": "RL-DE-099",
        "name": "Auto-Recloser Relay",
        "type": "Transformer",
        "location": "Substation C",
        "installed": "2018-12-05",
        "nominal_capacity": 80,
        "current_load_pct": 100,
    },
    {
        "id": "SN-TH-042",
        "name": "Vibration Sensor Core",
        "type": "Sensor",
        "location": "Turbine Alpha",
        "installed": "2021-02-14",
        "nominal_capacity": 100,
        "current_load_pct": 45,
    },
]


def compute_asset_health(asset_id: str, load_pct: float) -> str:
    """
    Compute asset health status based on:
    1. Recent anomalies in Redis
    2. Load percentage vs capacity
    3. Maintenance history
    """
    
    # Check for recent critical anomalies linked to this asset
    latest_anomaly = redis_get("anomaly:latest")
    
    if latest_anomaly:
        try:
            anomaly = json.loads(latest_anomaly)
            severity = anomaly.get("severity", "low")
            affected_sensors = anomaly.get("affected_sensors", [])
            # If this asset has affected sensors and high severity, mark as Critical
            if severity in ["critical", "high"] and asset_id in str(affected_sensors):
                return "Critical"
        except:
            pass
    
    # Load-based health assessment
    if load_pct >= 95:
        return "Critical"
    elif load_pct >= 80:
        return "Degraded"
    elif load_pct >= 70:
        return "Warning"
    else:
        return "Healthy"


def compute_uptime(asset_id: str) -> str:
    """
    Compute uptime from maintenance history and incidents.
    For now, use mock values. In production, query maintenance logs.
    """
    uptime_map = {
        "TX-AT-022": "98.2%",
        "FL-110-PL-003": "99.1%",
        "SN-CZ-115": "99.9%",
        "BATT-ST-09": "100%",
        "RL-DE-099": "85.4%",
        "SN-TH-042": "96.5%",
    }
    return uptime_map.get(asset_id, "99.0%")


def get_last_maintenance_date(asset_id: str) -> str:
    """
    Get last maintenance date for the asset.
    For now, mock data. In production, query maintenance DB.
    """
    maintenance_map = {
        "TX-AT-022": "2024-02-20",
        "FL-110-PL-003": "2024-01-05",
        "SN-CZ-115": "2024-02-20",
        "BATT-ST-09": "2023-08-15",
        "RL-DE-099": "2023-10-01",
        "SN-TH-042": "2024-01-18",
    }
    return maintenance_map.get(asset_id, "2024-01-01")


@router.get("/assets")
async def get_assets():
    """
    Returns all registered assets with computed health status.
    
    - Queries mock asset registry (TODO: replace with DB)
    - Computes health from latest anomaly + load
    - Sorts by severity then name
    
    Response:
        {
            "assets": [
                {
                    "id": "TX-AT-022",
                    "name": "Alpha Transformer Hub",
                    "type": "Transformer",
                    "health": "Critical",
                    "location": "Substation A",
                    "lastMaintenance": "2024-02-20",
                    "uptime": "98.2%",
                    "load": "89%"
                }
            ],
            "count": 6
        }
    """
    
    assets = []
    
    for asset in ASSET_REGISTRY:
        health = compute_asset_health(asset["id"], asset["current_load_pct"])
        
        asset_response = {
            "id": asset["id"],
            "name": asset["name"],
            "type": asset["type"],
            "health": health,
            "location": asset["location"],
            "lastMaintenance": get_last_maintenance_date(asset["id"]),
            "uptime": compute_uptime(asset["id"]),
            "load": f"{asset['current_load_pct']}%",
        }
        assets.append(asset_response)
    
    # Sort by severity (Critical > Degraded > Warning > Healthy) then by name
    severity_order = {"Critical": 0, "Degraded": 1, "Warning": 2, "Healthy": 3}
    assets.sort(key=lambda x: (severity_order.get(x["health"], 4), x["name"]))
    
    return {
        "assets": assets,
        "count": len(assets),
    }
