import logging
from time import perf_counter
from typing import Optional, Tuple

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from app.schemas.analysis import AnalyzeRequest, AnalyzeResponse
from app.services.assistant_service import (
    generate_suggestions,
    get_breakdown,
    rewrite_text,
)
from app.services.explanation_service import generate_explanation
from app.services.inference_service import (
    InferenceTimeoutError,
    ModelInferenceError,
    analyze_text,
)
from app.services.report_store import get_report, save_report
from app.services.url_extraction_service import extract_text_from_url

router = APIRouter(tags=["analysis"])
logger = logging.getLogger(__name__)


def _resolve_analysis_input(request: AnalyzeRequest) -> Tuple[str, str, Optional[str]]:
    text = (request.text or "").strip()
    url = (request.url or "").strip()

    if text:
        return text, "text", url or None

    if url:
        return extract_text_from_url(url), "url", url

    if request.text is not None:
        raise ValueError("Text must not be empty")

    if request.url is not None:
        raise ValueError("URL must not be empty")

    raise ValueError("Text or URL must be provided")


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_news(request: AnalyzeRequest):
    start = perf_counter()
    input_size = len(request.text or request.url or "")

    logger.info(
        "analysis_request_received",
        extra={"input_size": input_size},
    )

    try:
        clean_text, source_type, source_url = _resolve_analysis_input(request)
        explanation = generate_explanation(clean_text)
        breakdown = get_breakdown(clean_text)
        suggested_rewrite = rewrite_text(clean_text)
        suggestions = generate_suggestions(clean_text, explanation)
        prediction = analyze_text(clean_text, explanation=explanation)
        processing_time_ms = int((perf_counter() - start) * 1000)

        report = save_report(
            {
                "credibility_score": prediction["credibility_score"],
                "risk_level": prediction["risk_level"],
                "confidence": prediction["confidence"],
                "explanation": explanation,
                "breakdown": breakdown,
                "suggested_rewrite": suggested_rewrite,
                "suggestions": suggestions,
                "processing_time_ms": processing_time_ms,
                "analyzed_text": clean_text,
                "source_type": source_type,
                "source_url": source_url,
            }
        )

        return AnalyzeResponse(
            report_id=report["report_id"],
            credibility_score=prediction["credibility_score"],
            risk_level=prediction["risk_level"],
            confidence=prediction["confidence"],
            explanation=explanation,
            breakdown=breakdown,
            suggested_rewrite=suggested_rewrite,
            suggestions=suggestions,
            processing_time_ms=processing_time_ms,
            analyzed_text=clean_text,
            source_type=source_type,
            source_url=source_url,
        )
    except InferenceTimeoutError:
        logger.error("analysis_processing_timeout", extra={"input_size": input_size})
        return JSONResponse(status_code=504, content={"error": "processing timeout"})
    except ModelInferenceError:
        logger.exception("analysis_model_failure", extra={"input_size": input_size})
        return JSONResponse(status_code=500, content={"error": "model inference failed"})
    except ValueError as exc:
        logger.warning("analysis_bad_request", extra={"error": str(exc)})
        return JSONResponse(status_code=400, content={"error": str(exc)})
    except Exception as exc:
        logger.exception("analysis_unexpected_error", extra={"input_size": input_size})
        return JSONResponse(status_code=500, content={"error": "unexpected analysis error"})


@router.get("/report/{report_id}", response_model=AnalyzeResponse)
async def read_report(report_id: str):
    report = get_report(report_id)

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    return AnalyzeResponse(**report)
