(function () {
  const HIGHLIGHT_CLASS = "aica-credibility-highlight";
  const SUPPORTED_TYPES = new Set([
    "emotional_language",
    "clickbait",
    "all_caps",
    "excessive_punctuation"
  ]);
  const EMOTIONAL_WORDS = [
    "breaking",
    "exposed",
    "outrage",
    "panic",
    "scandal",
    "secret",
    "shocking",
    "unbelievable",
    "urgent",
    "warning"
  ];
  const CLICKBAIT_PHRASES = [
    "you won't believe",
    "truth revealed"
  ];

  function applyHighlights(explanation = []) {
    clearHighlights();
    const targets = buildTargets(explanation);
    let count = 0;

    for (const target of targets) {
      count += highlightPhrase(target.phrase, target.type);
      if (count >= 120) {
        break;
      }
    }

    return {
      ok: true,
      count
    };
  }

  function clearHighlights() {
    const highlights = [...document.querySelectorAll(`.${HIGHLIGHT_CLASS}`)];
    for (const highlight of highlights) {
      const parent = highlight.parentNode;
      if (!parent) {
        continue;
      }
      parent.replaceChild(document.createTextNode(highlight.textContent || ""), highlight);
      parent.normalize();
    }
    return {
      ok: true,
      count: highlights.length
    };
  }

  function buildTargets(explanation) {
    const targets = [];
    const seen = new Set();

    for (const item of explanation || []) {
      if (!SUPPORTED_TYPES.has(item.type)) {
        continue;
      }

      addTarget(targets, seen, item.text, item.type);

      if (item.type === "emotional_language" || item.type === "clickbait") {
        for (const word of EMOTIONAL_WORDS) {
          if (containsPhrase(item.text, word)) {
            addTarget(targets, seen, word, item.type);
          }
        }
      }

      if (item.type === "clickbait") {
        for (const phrase of CLICKBAIT_PHRASES) {
          if (containsPhrase(item.text, phrase)) {
            addTarget(targets, seen, phrase, "clickbait");
          }
        }
      }
    }

    return targets
      .filter((target) => target.phrase.length >= 2)
      .sort((a, b) => {
        const priority = typePriority(b.type) - typePriority(a.type);
        return priority || b.phrase.length - a.phrase.length;
      })
      .slice(0, 60);
  }

  function addTarget(targets, seen, phrase, type) {
    const normalized = normalizePhrase(phrase);
    if (!normalized) {
      return;
    }

    const key = `${type}:${normalized.toLowerCase()}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    targets.push({
      phrase: normalized.length > 220 ? normalized.slice(0, 220).trim() : normalized,
      type
    });
  }

  function typePriority(type) {
    if (type === "clickbait") {
      return 4;
    }
    if (type === "all_caps") {
      return 3;
    }
    if (type === "excessive_punctuation") {
      return 2;
    }
    return 1;
  }

  function highlightPhrase(phrase, type) {
    const regex = phraseRegex(phrase);
    if (!regex) {
      return 0;
    }

    const textNodes = collectVisibleTextNodes();
    let count = 0;

    for (const node of textNodes) {
      if (count >= 120) {
        break;
      }

      const text = node.nodeValue || "";
      const matches = findMatches(text, regex);
      if (!matches.length) {
        continue;
      }

      for (const match of matches.reverse()) {
        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match.text.length);

        const wrapper = document.createElement("span");
        wrapper.className = `${HIGHLIGHT_CLASS} ${HIGHLIGHT_CLASS}--${type}`;
        wrapper.dataset.aicaType = type;
        wrapper.title = labelForType(type);

        try {
          range.surroundContents(wrapper);
          count += 1;
        } catch (_error) {
          range.detach();
        }
      }
    }

    return count;
  }

  function collectVisibleTextNodes() {
    const nodes = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent || !node.nodeValue?.trim()) {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.closest(`.${HIGHLIGHT_CLASS}`) || shouldSkip(parent) || !isVisible(parent)) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let node = walker.nextNode();
    while (node) {
      nodes.push(node);
      node = walker.nextNode();
    }
    return nodes;
  }

  function shouldSkip(element) {
    if (
      element.closest(
        "script,style,noscript,template,svg,canvas,iframe,nav,footer,aside,form,button,input,select,textarea,[contenteditable='true']"
      )
    ) {
      return true;
    }

    const pageHeader = element.closest("header");
    return Boolean(pageHeader && !pageHeader.closest("article,main,[role='main']"));
  }

  function isVisible(element) {
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
    return rect.width > 0 && rect.height > 0;
  }

  function findMatches(text, regex) {
    const matches = [];
    regex.lastIndex = 0;
    let match = regex.exec(text);
    while (match) {
      matches.push({
        index: match.index,
        text: match[0]
      });

      if (match[0].length === 0) {
        regex.lastIndex += 1;
      }
      match = regex.exec(text);
    }
    return matches;
  }

  function phraseRegex(phrase) {
    const normalized = normalizePhrase(phrase);
    if (!normalized) {
      return null;
    }

    const pattern = normalized
      .split(/\s+/)
      .map(escapeRegex)
      .join("\\s+");

    try {
      return new RegExp(pattern, "gi");
    } catch (_error) {
      return null;
    }
  }

  function normalizePhrase(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function containsPhrase(text, phrase) {
    return new RegExp(`\\b${escapeRegex(phrase)}\\b`, "i").test(String(text || ""));
  }

  function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function labelForType(type) {
    switch (type) {
      case "clickbait":
        return "Clickbait framing";
      case "all_caps":
        return "ALL CAPS language";
      case "excessive_punctuation":
        return "Excessive punctuation";
      default:
        return "Emotional language";
    }
  }

  window.AICAHighlighter = {
    applyHighlights,
    clearHighlights
  };
})();
