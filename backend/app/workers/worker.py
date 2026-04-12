import sys
import os
from pathlib import Path

# This finds the 'backend' folder and then goes one level up to the PROJECT ROOT
base_path = Path(__file__).resolve().parent.parent.parent.parent
sys.path.append(str(base_path))

# Now try the imports
try:
    from models.detection import run_detection
    print("Successfully imported models.detection!")
except ImportError as e:
    print(f"STILL FAILING. Looking in: {base_path}")
    print(f"Current sys.path: {sys.path}")
    raise e

# Your other imports
import time
import json
from app.services.processing import get_last_window, window_to_df
from app.core.redis import redis_set, redis_client

def start_analysis_worker():
    print("Analysis Worker is running...")

    while True:
        # print("Pipeline result:", result)

        time.sleep(5)

        try:
            # 1. FETCH: Get the last 60 seconds of data from Influx
            data = get_last_window(60)
            if not data:
                print("wait... no data found in InfluxDB yet.")
                time.sleep(5)
                continue

            # 2. PROCESS: Convert to DataFrame for your models
            pdData = window_to_df(data)

            # 3. DETECT: Run your Z-Score, IForest, and LSTM ensemble
            result = run_detection(pdData)

            if result:
                # Convert the dictionary to a JSON string for Redis
                json_result = json.dumps(result)

                # --- REDIS STORAGE ---

                # A. Store LATEST result (Overwrites every loop) - ALWAYS do this for live graph
                # Key: 'anomaly:latest'
                redis_set("anomaly:latest", json_result, expire_seconds=3600)

                # B. Store in HISTORY only if it's a real anomaly
                if result.get("is_anomaly"):
                    # Key: 'anomaly:history'
                    # lpush puts it at the top, ltrim keeps only the last 50 entries
                    redis_client.lpush("anomaly:history", json_result)
                    redis_client.ltrim("anomaly:history", 0, 49)
                    print(f"🚨 Anomaly detected! Severity: {result.get('severity')}")

                # C. Extract specific metric for the Gauges
                if "ensemble_score" in result:
                    redis_set("analytics:ensemble_score", str(result["ensemble_score"]))

                if not result.get("is_anomaly"):
                    print(f"📊 Nominal data processed. Ensemble Score: {result.get('ensemble_score')}")

        except Exception as e:
            print(f"⚠️ Worker Error: {e}")
            # Don't crash the whole app, just wait and try again
            time.sleep(10)

        # 4. SLEEP: Wait 5 seconds before the next analysis window
        time.sleep(5)

