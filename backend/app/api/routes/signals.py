from fastapi import APIRouter
from app.services.processing import get_last_window

router = APIRouter()

@router.get("/live")
async def get_live_signals():
    data = get_last_window(60)
    return {
        "count": len(data),
        "data": data[:50]  # limit for now
    }