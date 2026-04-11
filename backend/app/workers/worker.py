import time
import json
from app.services.processing import get_last_window, window_to_df
from app.services.detection import run_detection
from app.core.redis import redis_set, redis_client

def start_analysis_worker():
    print("Analysis Worker is running...")

    while True:
        print("Pipeline result:", result)

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
            # This returns the JSON object you showed me earlier
            result = run_detection(pdData)

            if result:
                # Convert the dictionary to a JSON string for Redis
                json_result = json.dumps(result)

                # --- REDIS STORAGE ---

                # A. Store LATEST result (Overwrites every loop)
                # Key: 'anomaly:latest'
                redis_set("anomaly:latest", json_result, expire_seconds=3600)

                # B. Store in HISTORY (Pushes to a list for the sidebar)
                # Key: 'anomaly:history'
                # lpush puts it at the top, ltrim keeps only the last 50 entries
                redis_client.lpush("anomaly:history", json_result)
                redis_client.ltrim("anomaly:history", 0, 49)

                # C. Extract specific metric for the Gauges (Optional but helpful)
                # This makes it easier for the frontend to grab just the 88.4% index
                if "ensemble_score" in result:
                    redis_set("analytics:ensemble_score", str(result["ensemble_score"]))

                print(f"📊 Pipeline result processed. Severity: {result.get('severity')}")

        except Exception as e:
            print(f"⚠️ Worker Error: {e}")
            # Don't crash the whole app, just wait and try again
            time.sleep(10)

        # 4. SLEEP: Wait 5 seconds before the next analysis window
        time.sleep(5)

