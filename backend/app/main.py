from fastapi import FastAPI
from app.api.routes import signals

app = FastAPI()

app.include_router(signals.router, prefix="/signals")