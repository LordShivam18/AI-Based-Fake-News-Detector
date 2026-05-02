from transformers import pipeline

from app.core.config import MODEL_NAME


class SentimentCredibilityModel:
    def __init__(self, model_name: str = MODEL_NAME) -> None:
        self.model_name = model_name
        self.classifier = pipeline(
            "sentiment-analysis",
            model=model_name,
            tokenizer=model_name,
        )

    def predict_credibility(self, text: str) -> float:
        result = self.classifier(text, truncation=True, max_length=512)[0]
        label = str(result.get("label", "")).upper()
        confidence = float(result.get("score", 0.0))

        if label == "POSITIVE":
            score = confidence
        else:
            score = 1.0 - confidence

        return round(max(0.0, min(1.0, score)), 4)


model = SentimentCredibilityModel()
