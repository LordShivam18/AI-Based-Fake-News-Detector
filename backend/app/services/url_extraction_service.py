import re
from html.parser import HTMLParser
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

MAX_BYTES = 500_000
URL_TIMEOUT_SECONDS = 8


class ReadableTextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._skip_depth = 0
        self._capture_stack: list[str] = []
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, _attrs) -> None:
        normalized_tag = tag.lower()
        if normalized_tag in {"script", "style", "noscript", "svg"}:
            self._skip_depth += 1
            return

        if normalized_tag in {"title", "h1", "h2", "h3", "p", "li", "article"}:
            self._capture_stack.append(normalized_tag)

    def handle_endtag(self, tag: str) -> None:
        normalized_tag = tag.lower()
        if normalized_tag in {"script", "style", "noscript", "svg"} and self._skip_depth:
            self._skip_depth -= 1
            return

        if self._capture_stack and self._capture_stack[-1] == normalized_tag:
            self._capture_stack.pop()

    def handle_data(self, data: str) -> None:
        if self._skip_depth or not self._capture_stack:
            return

        text = re.sub(r"\s+", " ", data).strip()
        if len(text) >= 20:
            self.parts.append(text)


def _validate_url(url: str) -> str:
    clean_url = url.strip()
    parsed = urlparse(clean_url)

    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("URL must start with http:// or https://")

    return clean_url


def extract_text_from_url(url: str) -> str:
    clean_url = _validate_url(url)
    request = Request(
        clean_url,
        headers={"User-Agent": "AITrustEngineMVP/0.1"},
    )

    try:
        with urlopen(request, timeout=URL_TIMEOUT_SECONDS) as response:
            content_type = response.headers.get("Content-Type", "")
            raw = response.read(MAX_BYTES)
    except (HTTPError, URLError, TimeoutError, OSError) as exc:
        raise ValueError("Unable to fetch URL content") from exc

    if "text/html" not in content_type and "text/plain" not in content_type:
        raise ValueError("URL did not return readable text")

    decoded = raw.decode("utf-8", errors="ignore")

    if "text/plain" in content_type:
        text = re.sub(r"\s+", " ", decoded).strip()
    else:
        parser = ReadableTextParser()
        parser.feed(decoded)
        text = " ".join(parser.parts)
        text = re.sub(r"\s+", " ", text).strip()

    if len(text) < 40:
        raise ValueError("Could not extract enough article text from URL")

    return text[:5000]
