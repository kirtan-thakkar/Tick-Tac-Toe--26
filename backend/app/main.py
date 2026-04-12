from fastapi import FastAPI
from app.api.routes import signals, anomalies, feedback, assets, overview, charts, logs
import threading
from fastapi import FastAPI
from app.workers.worker import start_analysis_worker


app = FastAPI(title="SentinelIQ API")

# include routes
app.include_router(signals.router, prefix="/signals", tags=["Signals"])
app.include_router(anomalies.router, prefix="/anomalies", tags=["Anomalies"])
app.include_router(feedback.router, prefix="/feedback", tags=["Feedback"])
app.include_router(assets.router, prefix="/api", tags=["Assets"])
app.include_router(overview.router, prefix="/api", tags=["Overview"])
app.include_router(charts.router, prefix="/api", tags=["Charts"])
app.include_router(logs.router, prefix="/api", tags=["Logs"])


@app.get("/")
def root():
    return {"message": "SentinelIQ Backend Running 🚀"}

@app.on_event("startup")
async def startup_event():
    # Start the worker in a background thread
    daemon_thread = threading.Thread(target=start_analysis_worker, daemon=True)
    daemon_thread.start()