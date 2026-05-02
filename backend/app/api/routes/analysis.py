import logging

from fastapi import APIRouter, HTTPException

from app.schemas.analysis import AnalyzeRequest, AnalyzeResponse
from app.services.explanation_service import generate_explanation
from app.services.inference_service import analyze_text

router = APIRouter(tags=["analysis"])
logger = logging.getLogger(__name__)


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_news(request: AnalyzeRequest):
    try:
        prediction = analyze_text(request.text)
        explanation = generate_explanation(request.text)

        return AnalyzeResponse(
            credibility_score=prediction["credibility_score"],
            risk_level=prediction["risk_level"],
            explanation=explanation,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Analysis failed")
        raise HTTPException(status_code=500, detail="Analysis failed") from exc
