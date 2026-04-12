import pandas as pd
from app.core.influx import query_api
from app.core.config import settings

def _query_window(seconds: int):
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

            sensor_keys = sorted(
                [k for k in raw.keys() if k.startswith("sensor_")],
                key=lambda x: int(x.split("_")[1])
            )

            ordered_row = {"timestamp": raw["_time"]}
            for k in sensor_keys:
                ordered_row[k] = raw[k]

            if "anomaly" in raw:
                ordered_row["anomaly"] = raw["anomaly"]

            data.append(ordered_row)

    data.sort(key=lambda x: x["timestamp"])
    return data


def get_last_window(seconds=60, required_rows=60, max_lookback_seconds=900):
    """
    Fetch the newest records needed by detection.

    If the last `seconds` window has fewer than `required_rows`, widen the
    range progressively and return only the latest `required_rows` rows.
    """
    lookback = max(int(seconds), int(required_rows))
    attempts = 0

    while lookback <= max_lookback_seconds and attempts < 6:
        data = _query_window(lookback)
        if len(data) >= required_rows:
            return data[-required_rows:]

        lookback = min(lookback * 2, max_lookback_seconds)
        attempts += 1

    # Return whatever we could fetch; caller decides if it's enough.
    return _query_window(max_lookback_seconds)

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


# if __name__ == "__main__":
#     # Point this to your actual CSV file location
    
#     data = get_last_window(360000)
#     csvv = window_to_df(data)

#     print(len(csvv))
#     print(csvv)
