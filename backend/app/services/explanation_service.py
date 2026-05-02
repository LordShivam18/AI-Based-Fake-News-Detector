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
    r"https?://\S+",
    r"www\.\S+",
    r"\baccording to\b",
    r"\bsource:",
    r"\breported by\b",
    r"\bcited by\b",
)

HEURISTIC_PENALTIES = {
    "emotional_language": 0.2,
    "all_caps": 0.15,
    "excessive_punctuation": 0.15,
    "missing_sources": 0.25,
    "clickbait": 0.15,
}


def _split_sentences(text: str) -> list[str]:
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    return [sentence.strip() for sentence in sentences if sentence.strip()]


def _has_source(text: str) -> bool:
    return any(re.search(pattern, text, flags=re.IGNORECASE) for pattern in SOURCE_PATTERNS)


def _append_unique(explanations: list[dict], signal_type: str, matched_text: str) -> None:
    item = {"type": signal_type, "text": matched_text.strip()}
    if item not in explanations:
        explanations.append(item)


def detect_heuristic_signals(text: str) -> list[dict]:
    explanations: list[dict] = []
    sentences = _split_sentences(text) or [text.strip()]

    emotional_pattern = re.compile(
        r"\b(" + "|".join(sorted(EMOTIONALLY_CHARGED_WORDS)) + r")\b",
        flags=re.IGNORECASE,
    )

    for sentence in sentences:
        has_emotional_language = bool(emotional_pattern.search(sentence))
        has_caps = bool(re.search(r"\b[A-Z]{3,}\b", sentence))
        has_excessive_punctuation = bool(re.search(r"(!{2,}|\?{2,}|!\?|\?!)+", sentence))

        if has_emotional_language:
            _append_unique(explanations, "emotional_language", sentence)

        for match in re.finditer(r"\b[A-Z]{3,}\b", sentence):
            _append_unique(explanations, "all_caps", match.group(0))

        for match in re.finditer(r"(!{2,}|\?{2,}|!\?|\?!)+", sentence):
            _append_unique(explanations, "excessive_punctuation", match.group(0))

        if has_emotional_language and (has_caps or has_excessive_punctuation):
            _append_unique(explanations, "clickbait", sentence)

    if not _has_source(text):
        _append_unique(explanations, "missing_sources", "No links or source references found")

    if not explanations:
        _append_unique(explanations, "no_risk_signals", "No obvious rule-based risk signals detected")

    return explanations


def calculate_heuristic_score(explanations: list[dict]) -> float:
    signal_types = {item["type"] for item in explanations}
    penalty = sum(HEURISTIC_PENALTIES.get(signal_type, 0.0) for signal_type in signal_types)
    return round(max(0.0, 1.0 - min(penalty, 0.85)), 4)


def generate_explanation(text: str) -> list[dict]:
    return detect_heuristic_signals(text)
