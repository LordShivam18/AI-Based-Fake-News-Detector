from app.models.model_loader import model
from app.schemas.analysis import RiskLevel


def _risk_level_from_score(score: float) -> RiskLevel:
    if score < 0.4:
        return "HIGH"
    if score <= 0.7:
        return "MEDIUM"
    return "LOW"


def analyze_text(text: str) -> dict:
    clean_text = text.strip()
    if not clean_text:
        raise ValueError("Text must not be empty")

    credibility_score = model.predict_credibility(clean_text)

    return {
        "credibility_score": credibility_score,
        "risk_level": _risk_level_from_score(credibility_score),
    }
