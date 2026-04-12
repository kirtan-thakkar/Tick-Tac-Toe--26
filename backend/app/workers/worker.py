import sys
import os
from pathlib import Path

# This finds the 'backend' folder and then goes one level up to the PROJECT ROOT
base_path = Path(__file__).resolve().parent.parent.parent.parent
sys.path.append(str(base_path))

# Now try the imports
try:
    from models.detection import run_detection, MODELS_DIR
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
from app.api.routes.logs import log_event

def start_analysis_worker():
    print("Analysis Worker is running...")
    log_event("system", f"Analysis worker started. Models loaded from {MODELS_DIR}")

    while True:
        # print("Pipeline result:", result)

        time.sleep(5)

        try:
            # 1. FETCH: Get the last 60 seconds of data from Influx
            data = get_last_window(60)
            if not data:
                print("wait... no data found in InfluxDB yet.")
                log_event("data", "No data found in InfluxDB for 60s window")
                time.sleep(5)
                continue

            log_event("data", f"Fetched {len(data)} records from InfluxDB window")

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
                    log_event(
                        "anomaly",
                        f"Anomaly detected severity={result.get('severity')} score={result.get('ensemble_score')} type={result.get('anomaly_type')}"
                    )

                # C. Extract specific metric for the Gauges
                if "ensemble_score" in result:
                    redis_set("analytics:ensemble_score", str(result["ensemble_score"]))

                model_outputs = result.get("model_outputs") or {}
                z_score = (model_outputs.get("zscore") or {}).get("score")
                if_score = (model_outputs.get("iforest") or {}).get("score")
                lstm_score = (model_outputs.get("lstm") or {}).get("score")
                if z_score is None or if_score is None or lstm_score is None:
                    log_event(
                        "inference",
                        "Model outputs unavailable "
                        f"reason={result.get('message', 'not_produced')} "
                        f"rows={len(pdData) if pdData is not None else 0}"
                    )
                else:
                    log_event(
                        "inference",
                        f"Model outputs zscore={z_score} iforest={if_score} lstm={lstm_score} ensemble={result.get('ensemble_score')}"
                    )

                if not result.get("is_anomaly"):
                    print(f"📊 Nominal data processed. Ensemble Score: {result.get('ensemble_score')}")
                    log_event("system", f"Nominal cycle completed ensemble={result.get('ensemble_score')}")

        except Exception as e:
            print(f"⚠️ Worker Error: {e}")
            log_event("error", f"Worker error: {e}")
            # Don't crash the whole app, just wait and try again
            time.sleep(10)

        # 4. SLEEP: Wait 5 seconds before the next analysis window
        time.sleep(5)

