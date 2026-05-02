import logging
from time import perf_counter

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.schemas.analysis import AnalyzeRequest, AnalyzeResponse
from app.services.explanation_service import generate_explanation
from app.services.inference_service import (
    InferenceTimeoutError,
    ModelInferenceError,
    analyze_text,
)

router = APIRouter(tags=["analysis"])
logger = logging.getLogger(__name__)


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_news(request: AnalyzeRequest):
    start = perf_counter()
    clean_text = request.text.strip()

    logger.info(
        "analysis_request_received",
        extra={"input_size": len(request.text)},
    )

    if not clean_text:
        logger.warning("analysis_rejected_empty_input")
        return JSONResponse(status_code=400, content={"error": "Text must not be empty"})

    try:
        explanation = generate_explanation(clean_text)
        prediction = analyze_text(clean_text, explanation=explanation)
        processing_time_ms = int((perf_counter() - start) * 1000)

        return AnalyzeResponse(
            credibility_score=prediction["credibility_score"],
            risk_level=prediction["risk_level"],
            confidence=prediction["confidence"],
            explanation=explanation,
            processing_time_ms=processing_time_ms,
        )
    except InferenceTimeoutError:
        logger.error("analysis_processing_timeout", extra={"input_size": len(request.text)})
        return JSONResponse(status_code=504, content={"error": "processing timeout"})
    except ModelInferenceError:
        logger.exception("analysis_model_failure", extra={"input_size": len(request.text)})
        return JSONResponse(status_code=500, content={"error": "model inference failed"})
    except ValueError as exc:
        logger.warning("analysis_bad_request", extra={"error": str(exc)})
        return JSONResponse(status_code=400, content={"error": str(exc)})
    except Exception as exc:
        logger.exception("analysis_unexpected_error", extra={"input_size": len(request.text)})
        return JSONResponse(status_code=500, content={"error": "unexpected analysis error"})
