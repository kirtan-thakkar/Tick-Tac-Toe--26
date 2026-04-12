import pandas as pd
import time
import os
from app.core.influx import write_api
from app.core.config import settings

# import sys
# import os

# # Adds the 'backend' directory to the search path
# sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from app.core.influx import write_api

def stream_csv_to_influx(file_path: str):
    # Load the data
    if not os.path.exists(file_path):
        print(f" Error: File {file_path} not found!")
        return

    df = pd.read_csv(file_path)
    
    # --- 1. PRE-FILTER COLUMNS (Optimization for 50+ sensors) ---
    # We identify which columns are actually sensors ONCE at the start.
    sensor_cols = [c for c in df.columns if c.lower() not in ["timestamp"]]
    
    print(f"🚀 Found {len(sensor_cols)} sensors. Starting infinite 1Hz stream...")

    while True: # Keep the demo looping forever
        for index, row in df.iterrows():
            # --- 2. FAST FIELD CONSTRUCTION ---
            # We build the data string for all 50 sensors in one go.
            fields = []
            for col in sensor_cols:
                val = row[col]
                if not pd.isna(val):
                    fields.append(f"{col}={float(val)}")

            if not fields:
                continue

            # Format the "Line Protocol" for InfluxDB
            field_str = ",".join(fields)
            point = f"sensor_data {field_str}"

            try:
                # --- 3. THE LIVE WRITE ---
                write_api.write(bucket=settings.INFLUX_BUCKET, record=point)

                # Progress update every 5 seconds so you know it's working
                if index % 5 == 0:
                    print(f"📡 [LIVE] Row {index}: Syncing {len(sensor_cols)} sensors...")

            except Exception as e:
                print(f"⚠️ Connection glitch: {e}. Retrying...")
                time.sleep(2)

            # --- 4. THE 1-SECOND HEARTBEAT ---
            # This is what simulates the real-time sensor pulse!
            time.sleep(1)

        print("♻️ CSV finished. Restarting loop to keep the dashboard active...")

# This block allows you to run this file by itself in a separate terminal
if __name__ == "__main__":
    # Point this to your actual CSV file location
    CSV_FILE = "app/dataset/smd_test.csv"
    stream_csv_to_influx(CSV_FILE)