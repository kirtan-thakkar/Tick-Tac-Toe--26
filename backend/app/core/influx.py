from influxdb_client import InfluxDBClient

from influxdb_client.client.write_api import SYNCHRONOUS
from app.core.config import settings

client = InfluxDBClient(
    url=settings.INFLUX_URL,
    token=settings.INFLUX_TOKEN,
    org=settings.INFLUX_ORG
)

write_api = client.write_api(write_options=SYNCHRONOUS)
query_api = client.query_api()