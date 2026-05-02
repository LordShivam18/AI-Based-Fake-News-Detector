from typing import List, Literal

from pydantic import BaseModel, constr

RiskLevel = Literal["LOW", "MEDIUM", "HIGH"]


class AnalyzeRequest(BaseModel):
    text: constr(strip_whitespace=True, min_length=1)


class AnalyzeResponse(BaseModel):
    credibility_score: float
    risk_level: RiskLevel
    explanation: List[str]
