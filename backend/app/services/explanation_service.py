import re

EMOTIONALLY_CHARGED_WORDS = {
    "shocking",
    "unbelievable",
    "urgent",
    "breaking",
    "exposed",
    "secret",
    "scandal",
    "outrage",
    "panic",
    "warning",
}

SOURCE_PATTERNS = (
    "http://",
    "https://",
    "www.",
    "according to",
    "source:",
    "reported by",
)


def generate_explanation(text: str) -> list[str]:
    explanations: list[str] = []
    normalized_text = text.lower()

    if any(word in normalized_text for word in EMOTIONALLY_CHARGED_WORDS):
        explanations.append("Emotionally charged language detected")

    words = re.findall(r"\b[A-Z]{3,}\b", text)
    if words:
        explanations.append("ALL CAPS words detected")

    if re.search(r"(!{2,}|\?{2,}|!\?|\?!)+", text):
        explanations.append("Excessive punctuation detected")

    if not any(pattern in normalized_text for pattern in SOURCE_PATTERNS):
        explanations.append("No clear source or link detected")

    if explanations and (
        "Emotionally charged language detected" in explanations
        or "Excessive punctuation detected" in explanations
    ):
        explanations.append("Possible clickbait pattern")

    if not explanations:
        explanations.append("No obvious rule-based risk signals detected")

    return explanations
