from transformers import pipeline

from app.core.config import MODEL_INPUT_TEMPLATE, MODEL_NAME


FAKE_LABELS = {"FAKE", "FALSE", "UNRELIABLE", "MISLEADING", "LABEL_0"}
REAL_LABELS = {"REAL", "TRUE", "RELIABLE", "LABEL_1"}


class PretrainedNewsModel:
    def __init__(self, model_name: str = MODEL_NAME) -> None:
        self.model_name = model_name
        self.classifier = pipeline(
            "text-classification",
            model=model_name,
            tokenizer=model_name,
        )

    def predict_credibility(self, text: str) -> dict:
        model_input = MODEL_INPUT_TEMPLATE.format(text=text)
        result = self.classifier(model_input, truncation=True, max_length=512)[0]
        label = str(result.get("label", "")).upper()
        confidence = float(result.get("score", 0.0))

        if label in REAL_LABELS:
            score = confidence
        elif label in FAKE_LABELS:
            score = 1.0 - confidence
        else:
            score = 0.5

        return {
            "model_score": round(max(0.0, min(1.0, score)), 4),
            "confidence": round(max(0.0, min(1.0, confidence)), 4),
            "label": label,
        }


model = PretrainedNewsModel()
