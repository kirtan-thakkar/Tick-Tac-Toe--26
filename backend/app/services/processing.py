import pandas as pd
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

            # 1. Sort sensor keys numerically (0, 1, 2... 37)
            sensor_keys = sorted(
                [k for k in raw.keys() if k.startswith("sensor_")], 
                key=lambda x: int(x.split("_")[1])
            )

            # 2. ENFORCE THE STRICT CSV ORDER:
            # [timestamp, sensor_0, sensor_1, ..., sensor_37, anomaly]
            ordered_row = {}

            # Timestamp first
            ordered_row["timestamp"] = raw["_time"]

            # All sensors in numerical order
            for k in sensor_keys:
                ordered_row[k] = raw[k]

            # Anomaly last
            if "anomaly" in raw:
                ordered_row["anomaly"] = raw["anomaly"]

            data.append(ordered_row)

    # Chronological sort (ensures the 60 seconds are in order)
    data.sort(key=lambda x: x["timestamp"])

    return data

def window_to_df(window_data):
    """
    Converts to a Pandas DataFrame that looks EXACTLY like your CSV.
    The models can use 'timestamp' as an index or a column.
    """
    if not window_data:
        return None

    df = pd.DataFrame(window_data)

    # Ensure 'timestamp' is the index (standard for time-series ML)
    if 'timestamp' in df.columns:
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df.set_index('timestamp', inplace=True)

    return df


if __name__ == "__main__":
    # Point this to your actual CSV file location
    
    data = get_last_window(360000)
    csvv = window_to_df(data)

    print(len(csvv))
    print(csvv)
