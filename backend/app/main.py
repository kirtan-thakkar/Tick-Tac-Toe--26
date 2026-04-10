from fastapi import FastAPI
from app.api.routes import signals, anomalies


app = FastAPI(title="SentinelIQ API")

# include routes
app.include_router(signals.router, prefix="/signals", tags=["Signals"])
app.include_router(anomalies.router, prefix="/anomalies", tags=["Anomalies"])


@app.get("/")
def root():
    return {"message": "SentinelIQ Backend Running 🚀"}