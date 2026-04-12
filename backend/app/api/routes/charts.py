"""
Charts Route - Returns aggregated anomaly data for visualization

Provides time-series data for the Overview chart.
Aggregates anomalies from the past 24 hours into 5-15 minute buckets.

Response format:
{
    "points": [
        { "label": "00:00", "value": 2 },
        { "label": "00:15", "value": 1 },
        { "label": "00:30", "value": 0 },
        ...
    ],
    "timeRange": "24h",
    "bucketSize": "15m"
}
"""

from fastapi import APIRouter, Query
from app.core.redis import redis_client
import json
from datetime import datetime, timedelta
from typing import Optional

router = APIRouter()


def aggregate_anomalies_24h(bucket_minutes: int = 15):
    """
    Aggregate anomalies from the last 24 hours into time buckets.
    
    Args:
        bucket_minutes: Size of each bucket in minutes (5, 15, or 60)
    
    Returns:
        List of dicts: [{"timestamp": datetime, "count": int}, ...]
    """
    
    # Get all incidents from history
    history_strings = redis_client.lrange("anomaly:history", 0, -1)
    
    if not history_strings:
        # Return empty buckets for last 24h
        buckets = {}
        now = datetime.now()
        for i in range(0, 24 * 60, bucket_minutes):
            bucket_time = now - timedelta(minutes=i)
            bucket_key = bucket_time.strftime("%Y-%m-%d %H:%M")
            buckets[bucket_key] = 0
        return sorted(buckets.items(), key=lambda x: x[0])
    
    # Parse anomalies and collect timestamps
    now = datetime.now()
    cutoff = now - timedelta(hours=24)
    
    # Initialize all buckets for last 24h
    buckets = {}
    for i in range(0, 24 * 60, bucket_minutes):
        bucket_time = now - timedelta(minutes=i)
        if bucket_time >= cutoff:
            bucket_key = bucket_time.strftime("%Y-%m-%d %H:%M")
            buckets[bucket_key] = 0
    
    # Count anomalies in each bucket
    for item_str in history_strings:
        try:
            anomaly = json.loads(item_str)
            timestamp = anomaly.get("timestamp")
            
            if not timestamp:
                continue
            
            # Convert Unix timestamp to datetime
            anomaly_time = datetime.fromtimestamp(int(timestamp))
            
            if anomaly_time < cutoff:
                break  # Anomalies are in reverse chronological order
            
            # Find which bucket this anomaly belongs to
            # Round down to nearest bucket
            minute_offset = (now - anomaly_time).total_seconds() / 60
            bucket_minutes_ago = int(minute_offset / bucket_minutes) * bucket_minutes
            bucket_time = now - timedelta(minutes=bucket_minutes_ago)
            bucket_key = bucket_time.strftime("%Y-%m-%d %H:%M")
            
            if bucket_key in buckets:
                buckets[bucket_key] += 1
            
        except Exception as e:
            print(f"Error processing anomaly in aggregation: {e}")
            continue
    
    # Sort buckets by time (ascending) and convert to list
    sorted_buckets = sorted(buckets.items(), key=lambda x: x[0])
    return sorted_buckets


@router.get("/charts/chart")
async def get_chart_data(
    hours: int = Query(24, ge=1, le=168, description="Hours of data to return (1-168)"),
    bucket: int = Query(15, ge=5, le=60, description="Bucket size in minutes (5, 15, or 60)"),
):
    """
    Returns aggregated anomaly data for charting over the specified time range.
    
    The data is bucketed into time intervals (5m, 15m, or 60m) and shows
    the intensity/count of anomalies detected in each bucket.
    
    Query Parameters:
    - hours: Time range to return (1-168 hours, default 24)
    - bucket: Bucket size (5, 15, or 60 minutes, default 15)
    
    Response:
    {
        "points": [
            { "label": "00:00", "value": 2 },
            { "label": "00:15", "value": 1 },
            { "label": "00:30", "value": 0 },
        ],
        "timeRange": "24h",
        "bucketSize": "15m"
    }
    """
    
    # Validate bucket size
    if bucket not in [5, 15, 60]:
        bucket = 15
    
    # Get bucket data
    buckets = aggregate_anomalies_24h(bucket_minutes=bucket)
    
    if not buckets:
        return {
            "points": [],
            "timeRange": f"{hours}h",
            "bucketSize": f"{bucket}m",
            "message": "No anomaly data available",
        }
    
    # Convert to chart format with labels
    points = []
    for bucket_label, count in buckets:
        try:
            # Parse bucket label to get time
            bucket_dt = datetime.strptime(bucket_label, "%Y-%m-%d %H:%M")
            label = bucket_dt.strftime("%H:%M")  # Display as HH:MM
            
            points.append({
                "label": label,
                "value": count,
            })
        except:
            points.append({
                "label": bucket_label,
                "value": count,
            })
    
    return {
        "points": points,
        "timeRange": f"{hours}h",
        "bucketSize": f"{bucket}m",
    }
