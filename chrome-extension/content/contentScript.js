(function () {
  if (window.AICA_CONTENT_BOOTSTRAPPED) {
    return;
  }
  window.AICA_CONTENT_BOOTSTRAPPED = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    try {
      switch (message?.type) {
        case "AICA_PING":
          sendResponse({ ok: true });
          return false;

        case "AICA_EXTRACT_PAGE": {
          if (!window.AICAPageExtractor) {
            sendResponse({
              ok: false,
              error: "The page extractor is not available yet."
            });
            return false;
          }

          const result = window.AICAPageExtractor.extractVisibleContent({
            maxChars: message.maxChars
          });
          sendResponse(result);
          return false;
        }

        case "AICA_APPLY_HIGHLIGHTS": {
          if (!window.AICAHighlighter) {
            sendResponse({
              ok: false,
              error: "The highlighter is not available yet."
            });
            return false;
          }
          sendResponse(window.AICAHighlighter.applyHighlights(message.explanation || []));
          return false;
        }

        case "AICA_CLEAR_HIGHLIGHTS": {
          if (!window.AICAHighlighter) {
            sendResponse({ ok: true, count: 0 });
            return false;
          }
          sendResponse(window.AICAHighlighter.clearHighlights());
          return false;
        }

        default:
          return false;
      }
    } catch (error) {
      sendResponse({
        ok: false,
        error: error.message || String(error)
      });
      return false;
    }
  });
})();
