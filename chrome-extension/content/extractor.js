(function () {
  const NOISE_SELECTOR = [
    "script",
    "style",
    "noscript",
    "template",
    "svg",
    "canvas",
    "iframe",
    "nav",
    "footer",
    "aside",
    "form",
    "button",
    "input",
    "select",
    "textarea",
    "[aria-hidden='true']",
    "[hidden]"
  ].join(",");

  const NOISE_PATTERN =
    /\b(ad|ads|advert|banner|breadcrumb|cookie|footer|header|menu|modal|nav|newsletter|paywall|promo|related|share|sidebar|social|sponsor|subscribe|toolbar)\b/i;

  const CONTENT_SELECTOR = [
    "article",
    "main",
    "[role='main']",
    ".article",
    ".article-body",
    ".entry-content",
    ".post-content",
    ".story",
    ".story-body"
  ].join(",");

  const TEXT_SELECTOR = "h1,h2,h3,h4,p,blockquote,li";

  function extractVisibleContent(options = {}) {
    const maxChars = options.maxChars || 12000;
    const roots = getContentRoots();
    const seenNodes = new Set();
    const seenText = new Set();
    const chunks = [];
    let collectedChars = 0;

    for (const root of roots) {
      const nodes = root.matches?.(TEXT_SELECTOR)
        ? [root, ...root.querySelectorAll(TEXT_SELECTOR)]
        : [...root.querySelectorAll(TEXT_SELECTOR)];

      for (const node of nodes) {
        if (seenNodes.has(node) || shouldSkipElement(node) || !isVisibleElement(node)) {
          continue;
        }

        const text = cleanText(node.innerText || node.textContent || "");
        if (!isUsefulText(node, text)) {
          continue;
        }

        const key = text.toLowerCase();
        if (seenText.has(key)) {
          continue;
        }

        seenNodes.add(node);
        seenText.add(key);
        chunks.push({
          tag: node.tagName.toLowerCase(),
          text
        });
        collectedChars += text.length + 2;

        if (collectedChars >= maxChars) {
          break;
        }
      }

      if (chunks.length && collectedChars >= maxChars) {
        break;
      }
    }

    let source = "structured";
    if (totalTextLength(chunks) < 300) {
      const fallback = extractBodyFallback(maxChars);
      if (fallback.text.length > totalTextLength(chunks)) {
        source = "body-fallback";
        chunks.length = 0;
        chunks.push(...fallback.chunks);
      }
    }

    const fullText = chunks.map((chunk) => chunk.text).join("\n\n");
    const limited = limitText(fullText, maxChars);

    return {
      ok: limited.text.length > 0,
      text: limited.text,
      page: {
        title: cleanText(document.title || ""),
        url: window.location.href,
        language: document.documentElement.lang || "",
        source
      },
      stats: {
        chars: limited.text.length,
        words: countWords(limited.text),
        elements: chunks.length,
        truncated: limited.truncated,
        maxChars
      }
    };
  }

  function getContentRoots() {
    const candidates = [...document.querySelectorAll(CONTENT_SELECTOR)]
      .filter((element) => !shouldSkipElement(element) && isVisibleElement(element))
      .map((element) => ({
        element,
        score: scoreContentRoot(element)
      }))
      .filter((item) => item.score > 120)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((item) => item.element);

    return candidates.length ? candidates : [document.body].filter(Boolean);
  }

  function scoreContentRoot(element) {
    const text = cleanText(element.innerText || element.textContent || "");
    const paragraphCount = element.querySelectorAll("p").length;
    const headingCount = element.querySelectorAll("h1,h2,h3").length;
    return text.length + paragraphCount * 80 + headingCount * 40;
  }

  function extractBodyFallback(maxChars) {
    const lines = cleanText(document.body?.innerText || "")
      .split(/\n+/)
      .map(cleanText)
      .filter((line) => line.length >= 45)
      .slice(0, 80);

    const chunks = [];
    const seen = new Set();
    for (const line of lines) {
      const key = line.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      chunks.push({ tag: "text", text: line });
      if (totalTextLength(chunks) >= maxChars) {
        break;
      }
    }
    return {
      chunks,
      text: chunks.map((chunk) => chunk.text).join("\n\n")
    };
  }

  function shouldSkipElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return true;
    }

    if (element.closest(NOISE_SELECTOR)) {
      return true;
    }

    const pageHeader = element.closest("header");
    if (pageHeader && !pageHeader.closest("article,main,[role='main']")) {
      return true;
    }

    let current = element;
    while (current && current !== document.body) {
      const signature = `${current.id || ""} ${current.className || ""}`;
      if (NOISE_PATTERN.test(signature)) {
        return true;
      }
      current = current.parentElement;
    }

    return false;
  }

  function isVisibleElement(element) {
    const style = window.getComputedStyle(element);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0" ||
      style.contentVisibility === "hidden"
    ) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return false;
    }

    return true;
  }

  function isUsefulText(node, text) {
    if (!text) {
      return false;
    }

    const tag = node.tagName.toLowerCase();
    if (/^h[1-4]$/.test(tag)) {
      return text.length >= 6;
    }

    if (tag === "li") {
      return text.length >= 60 && countWords(text) >= 8;
    }

    return text.length >= 35 && countWords(text) >= 6;
  }

  function cleanText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s+/g, "\n")
      .replace(/\s+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function totalTextLength(chunks) {
    return chunks.reduce((total, chunk) => total + chunk.text.length + 2, 0);
  }

  function limitText(text, maxChars) {
    if (text.length <= maxChars) {
      return { text, truncated: false };
    }

    const slice = text.slice(0, maxChars);
    const sentenceBoundary = Math.max(
      slice.lastIndexOf(". "),
      slice.lastIndexOf("? "),
      slice.lastIndexOf("! "),
      slice.lastIndexOf("\n\n")
    );
    const safeEnd = sentenceBoundary > maxChars * 0.7 ? sentenceBoundary + 1 : maxChars;
    return {
      text: slice.slice(0, safeEnd).trim(),
      truncated: true
    };
  }

  function countWords(text) {
    return (text.match(/\b[\w'-]+\b/g) || []).length;
  }

  window.AICAPageExtractor = {
    extractVisibleContent
  };
})();
