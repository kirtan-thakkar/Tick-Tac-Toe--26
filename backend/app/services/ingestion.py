import pandas as pd
from app.core.influx import client, query_api
from app.core.config import settings

def verify_ingestion():
    print(f"--- Querying Bucket: {settings.INFLUX_BUCKET} ---")
    
    # Flux query to get the last 1 hour of 'sensor_data'
    # Pivot organizes fields (temp, hum, etc.) into columns for the same timestamp
    query = f'''
    from(bucket: "{settings.INFLUX_BUCKET}")
      |> range(start: -1h)
      |> filter(fn: (r) => r._measurement == "sensor_data")
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
    '''

    try:
        # Execute query
        tables = query_api.query(org=settings.INFLUX_ORG, query=query)
        
        results = []
        for table in tables:
            for record in table.records:
                # Merge time with all other field values
                row = {"time": record.get_time()}
                row.update(record.values)
                results.append(row)

        if not results:
            print("❌ Result: No data found in the last hour.")
            print("Check if your ingestion script is still running or if the bucket name is correct.")
        else:
            # Load into DataFrame for a nice terminal table
            df = pd.DataFrame(results)
            
            # Filter out internal InfluxDB columns for readability
            display_cols = [c for c in df.columns if c not in ['_start', '_stop', '_measurement', 'result', 'table']]
            
            print(f"✅ Success! Found {len(df)} records:")
            print(df[display_cols].to_string(index=False))

    except Exception as e:
        print(f"❌ Error querying InfluxDB: {e}")
    finally:
        # Good practice to close the client when done
        client.close()

if __name__ == "__main__":
    verify_ingestion()