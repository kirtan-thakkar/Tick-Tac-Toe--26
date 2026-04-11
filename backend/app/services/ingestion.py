import pandas as pd
import time
from app.core.influx import write_api
from app.core.config import settings


def stream_csv_to_influx(file_path: str):

    df = pd.read_csv(file_path)
    print("Starting CSV streaming...")

    for index, row in df.iterrows():
        fields = []

        for col in df.columns:
            value = row[col]

            # skip timestamp column if present
            if col.lower() == "timestamp":
                continue

            # skip null values
            if pd.isna(value):
                continue

            # ensure numeric (important for Influx)
            try:
                value = float(value)
            except:
                continue  # skip non-numeric safely

            fields.append(f"{col}={value}")
        if not fields:
            continue  # skip empty row

        field_str = ",".join(fields)
        point = f"sensor_data {field_str}"


        write_api.write(
            bucket=settings.INFLUX_BUCKET,
            record=point
        )
        print(f"Written row {index}")

        time.sleep(1)  # simulate real-time