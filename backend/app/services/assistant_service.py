import re

from app.services.explanation_service import EMOTIONALLY_CHARGED_WORDS, SOURCE_PATTERNS

ACRONYMS_TO_KEEP = {"AI", "API", "BBC", "CNN", "FBI", "NASA", "UN", "USA", "WHO"}
UNCERTAINTY_NOTE = (
    "This analysis is based on language patterns and may not reflect factual accuracy."
)


def _clamp_score(score: int) -> int:
    return max(0, min(100, score))


def _has_source(text: str) -> bool:
    return any(re.search(pattern, text, flags=re.IGNORECASE) for pattern in SOURCE_PATTERNS)


def _sentence_case(text: str) -> str:
    if not text:
        return text

    return re.sub(
        r"(^|[.!?]\s+)([a-z])",
        lambda match: match.group(1) + match.group(2).upper(),
        text,
    )


def risk_level_from_score(score: float) -> str:
    if score < 0.4:
        return "HIGH"
    if score <= 0.7:
        return "MEDIUM"
    return "LOW"


def get_improvement(before_score: float, after_score: float) -> dict:
    before_risk = risk_level_from_score(before_score)
    after_risk = risk_level_from_score(after_score)

    return {
        "before_score": round(before_score, 4),
        "after_score": round(after_score, 4),
        "change": f"{before_risk} -> {after_risk}",
    }


def rewrite_text(text: str) -> str:
    original_text = text.strip()
    neutral_text = original_text

    emotional_pattern = re.compile(
        r"\b(" + "|".join(sorted(EMOTIONALLY_CHARGED_WORDS)) + r")\b",
        flags=re.IGNORECASE,
    )
    neutral_text = re.sub(
        r"\byou won't believe\b",
        "",
        neutral_text,
        flags=re.IGNORECASE,
    )
    neutral_text = re.sub(
        r"\btruth revealed\b",
        "details reported",
        neutral_text,
        flags=re.IGNORECASE,
    )
    neutral_text = emotional_pattern.sub("", neutral_text)

    def normalize_caps(match: re.Match) -> str:
        word = match.group(0)
        if word in ACRONYMS_TO_KEEP:
            return word
        return word.lower()

    neutral_text = re.sub(r"\b[A-Z]{3,}\b", normalize_caps, neutral_text)
    neutral_text = re.sub(r"!{2,}", ".", neutral_text)
    neutral_text = re.sub(r"\?{2,}", "?", neutral_text)
    neutral_text = re.sub(r"([!?]){1,}$", ".", neutral_text)
    neutral_text = re.sub(r"\s*[-:]\s*", " ", neutral_text)
    neutral_text = re.sub(r"\s+([,.!?])", r"\1", neutral_text)
    neutral_text = re.sub(r"\s{2,}", " ", neutral_text).strip()

    if not re.search(r"[A-Za-z0-9]", neutral_text):
        neutral_text = "The claim should be reviewed with verified context."

    neutral_text = _sentence_case(neutral_text)

    if neutral_text and neutral_text[-1] not in ".!?":
        neutral_text += "."

    has_source = _has_source(original_text)
    word_count = len(re.findall(r"\b\w+\b", neutral_text))

    if neutral_text:
        if has_source:
            neutral_text = (
                "According to available information, "
                f"{neutral_text[0].lower() + neutral_text[1:]}"
            )
        else:
            neutral_text = f"Reportedly, {neutral_text[0].lower() + neutral_text[1:]}"

    if not has_source:
        neutral_text = f"{neutral_text} No verified evidence confirms this yet."
    elif word_count < 18:
        neutral_text = (
            f"{neutral_text} Additional context may be needed before drawing a firm conclusion."
        )

    return neutral_text or original_text


def get_breakdown(text: str) -> dict:
    language_score = 100
    structure_score = 100

    if any(
        re.search(rf"\b{re.escape(word)}\b", text, flags=re.IGNORECASE)
        for word in EMOTIONALLY_CHARGED_WORDS
    ):
        language_score -= 25

    if re.search(r"\b[A-Z]{3,}\b", text):
        language_score -= 20

    if re.search(r"(!{2,}|\?{2,}|!\?|\?!)+", text):
        language_score -= 20

    sentences = [sentence for sentence in re.split(r"(?<=[.!?])\s+", text.strip()) if sentence]
    words = re.findall(r"\b\w+\b", text)
    average_sentence_length = len(words) / max(len(sentences), 1)

    if len(words) < 25:
        structure_score -= 25

    if len(sentences) < 2:
        structure_score -= 20

    if average_sentence_length > 35:
        structure_score -= 15

    has_source = _has_source(text)
    source_score = 60 if has_source else 20
    source_note = (
        "Source reference detected, but this tool has not independently verified it."
        if has_source
        else "No verifiable sources detected."
    )

    return {
        "language_score": _clamp_score(language_score),
        "structure_score": _clamp_score(structure_score),
        "source_score": _clamp_score(source_score),
        "source_note": source_note,
    }


def generate_suggestions(text: str, explanation: list[dict]) -> list[str]:
    signal_types = {item["type"] for item in explanation}
    suggestions: list[str] = []

    if "emotional_language" in signal_types or "clickbait" in signal_types:
        suggestions.append("Use neutral, specific wording instead of emotional phrases.")

    if "all_caps" in signal_types:
        suggestions.append("Use normal sentence case unless an acronym is required.")

    if "excessive_punctuation" in signal_types:
        suggestions.append("Reduce repeated punctuation and let evidence carry the claim.")

    if "missing_sources" in signal_types:
        suggestions.append("Add credible sources, citations, or links readers can verify.")

    if get_breakdown(text)["structure_score"] < 75:
        suggestions.append("Break the claim into clear sentences with who, what, when, and where.")

    if not suggestions:
        suggestions.append("Keep the tone neutral and continue including verifiable context.")

    return suggestions
