from datetime import datetime
from influxdb_client import Point
from app.core.influx import write_api, query_api
from app.core.config import settings

class FeedbackStore:
    def __init__(self, bucket=settings.INFLUX_BUCKET):
        self.bucket = bucket

    def record(self, timestamp: int, operator_id: str, verdict: str, severity_agree: bool, notes: str = ""):
        """
        Record operator feedback for an anomaly.
        `timestamp` should be the integer timestamp of the anomaly to correctly associate the feedback.
        """
        point = Point("operator_feedback") \
            .tag("operator_id", operator_id) \
            .field("verdict", verdict) \
            .field("severity_agree", severity_agree) \
            .field("notes", notes) \
            .time(timestamp)

        write_api.write(bucket=self.bucket, record=point)

    def get_false_positive_rate(self, last_n=100) -> float:
        """Calculate the false positive rate over the last N feedback records."""
        query = f'''
            from(bucket: "{self.bucket}")
              |> range(start: -30d)
              |> filter(fn: (r) => r._measurement == "operator_feedback")
              |> filter(fn: (r) => r._field == "verdict")
              |> sort(columns: ["_time"], desc: true)
              |> limit(n: {last_n})
        '''
        tables = query_api.query(query, org=settings.INFLUX_ORG)
        
        records = []
        for table in tables:
            for record in table.records:
                records.append(record.get_value())
                
        if not records:
            return 0.0
            
        fps = sum(1 for v in records if v == "false_positive")
        return round(fps / len(records), 3)

    def get_retraining_candidates(self):
        """Return timestamps the retraining script should use as negative examples."""
        query = f'''
            from(bucket: "{self.bucket}")
              |> range(start: -30d)
              |> filter(fn: (r) => r._measurement == "operator_feedback")
              |> filter(fn: (r) => r._field == "verdict")
              |> filter(fn: (r) => r._value == "false_positive")
        '''
        tables = query_api.query(query, org=settings.INFLUX_ORG)
        
        timestamps = []
        for table in tables:
            for record in table.records:
                timestamps.append(record.get_time().timestamp())
        return timestamps

feedback_store = FeedbackStore()
