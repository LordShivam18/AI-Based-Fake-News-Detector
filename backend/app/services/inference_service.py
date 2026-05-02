from concurrent.futures import ThreadPoolExecutor, TimeoutError
from time import perf_counter
from typing import Optional

from app.core.config import MODEL_TIMEOUT_SECONDS
from app.core.logging import logger
from app.models.model_loader import model
from app.schemas.analysis import RiskLevel
from app.services.explanation_service import calculate_heuristic_score

MODEL_WEIGHT = 0.7
HEURISTIC_WEIGHT = 0.3
_executor = ThreadPoolExecutor(max_workers=1)


class InferenceTimeoutError(Exception):
    pass


class ModelInferenceError(Exception):
    pass


def _risk_level_from_score(score: float) -> RiskLevel:
    if score < 0.4:
        return "HIGH"
    if score <= 0.7:
        return "MEDIUM"
    return "LOW"


def _predict_with_timeout(text: str) -> dict:
    future = _executor.submit(model.predict_credibility, text)
    try:
        return future.result(timeout=MODEL_TIMEOUT_SECONDS)
    except TimeoutError as exc:
        future.cancel()
        raise InferenceTimeoutError("processing timeout") from exc


def analyze_text(text: str, explanation: Optional[list[dict]] = None) -> dict:
    clean_text = text.strip()
    if not clean_text:
        raise ValueError("Text must not be empty")

    start = perf_counter()

    try:
        model_prediction = _predict_with_timeout(clean_text)
    except InferenceTimeoutError:
        raise
    except Exception as exc:
        raise ModelInferenceError("model inference failed") from exc

    inference_time_ms = int((perf_counter() - start) * 1000)
    heuristic_score = calculate_heuristic_score(explanation or [])
    credibility_score = round(
        (model_prediction["model_score"] * MODEL_WEIGHT)
        + (heuristic_score * HEURISTIC_WEIGHT),
        4,
    )

    logger.info(
        "model_inference_completed",
        extra={
            "model_label": model_prediction.get("label"),
            "model_score": model_prediction["model_score"],
            "heuristic_score": heuristic_score,
            "final_score": credibility_score,
            "model_confidence": model_prediction["confidence"],
            "inference_time_ms": inference_time_ms,
        },
    )

    return {
        "credibility_score": credibility_score,
        "risk_level": _risk_level_from_score(credibility_score),
        "model_confidence": model_prediction["confidence"],
        "inference_time_ms": inference_time_ms,
    }
