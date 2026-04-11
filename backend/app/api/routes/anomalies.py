from fastapi import APIRouter
from app.services.processing import get_last_window

router = APIRouter()

@router.get("/live") # dummy function(for now) that will fetch data from redis and give to the frontend
async def get_live_signals():
    data = get_last_window(60)
    return {
        "count": len(data),
        "data": data[:50]  # limit for now
    }