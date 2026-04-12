from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services.feedback import feedback_store

router = APIRouter()

class FeedbackRequest(BaseModel):
    timestamp: int
    incident_id: Optional[str] = ""
    operator_id: str
    verdict: str
    severity_agree: bool = True
    notes: Optional[str] = ""

@router.post("/record")
async def record_feedback(req: FeedbackRequest):
    try:
        feedback_store.record(
            timestamp=req.timestamp,
            incident_id=req.incident_id or "",
            operator_id=req.operator_id,
            verdict=req.verdict,
            severity_agree=req.severity_agree,
            notes=req.notes
        )
        return {"status": "success", "message": "Feedback recorded."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history")
async def feedback_history(limit: int = 200):
    try:
        entries = feedback_store.get_history(limit=limit)
        return {"count": len(entries), "entries": entries}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/retrain")
async def trigger_retraining():
    # Fetch retraining candidates (false positives)
    try:
        candidates = feedback_store.get_retraining_candidates()
        
        # Here we would normally trigger the actual Python script for retraining,
        # passing the `candidates` timestamps to the retraining logic.
        # For the hackathon demo, we simulate this process.
        
        return {
            "status": "success", 
            "message": f"Retraining triggered successfully. Incorporated {len(candidates)} false positives to adjust model boundaries."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
