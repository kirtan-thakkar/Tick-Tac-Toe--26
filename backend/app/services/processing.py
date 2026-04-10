from app.core.influx import query_api
from app.core.config import settings

def get_last_window(seconds=60):
    query = f'''
    from(bucket: "{settings.INFLUX_BUCKET}")
      |> range(start: -{seconds}s)
      |> filter(fn: (r) => r._measurement == "sensor_data")
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
    '''

    result = query_api.query(org=settings.INFLUX_ORG, query=query)

    data = []
    for table in result:
        for record in table.records:
            raw = record.values
            
            # --- CLEANING LOGIC ---
            # We only want keys that are 'sensor_X' or 'anomaly'
            # We also keep '_time' but rename it for standard use
            clean_row = {
                k: v for k, v in raw.items() 
                if k.startswith("sensor_") or k == "anomaly"
            }
            
            # Add timestamp with a clean name
            clean_row["timestamp"] = raw["_time"]
            
            data.append(clean_row)

    # Sort by timestamp to ensure the window is in chronological order for the model
    data.sort(key=lambda x: x["timestamp"])
    
    return data