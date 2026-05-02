from typing import List, Literal

from pydantic import BaseModel, Field

RiskLevel = Literal["LOW", "MEDIUM", "HIGH"]
ExplanationType = Literal[
    "emotional_language",
    "all_caps",
    "excessive_punctuation",
    "missing_sources",
    "clickbait",
    "no_risk_signals",
]


class AnalyzeRequest(BaseModel):
    text: str


class ExplanationItem(BaseModel):
    type: ExplanationType
    text: str


class AnalyzeResponse(BaseModel):
    credibility_score: float = Field(..., ge=0, le=1)
    risk_level: RiskLevel
    confidence: float = Field(..., ge=0, le=1)
    explanation: List[ExplanationItem]
    processing_time_ms: int
