# AI Credibility Assistant Chrome Extension

Production-style Manifest V3 extension for the existing backend API.

## Folder Structure

```text
chrome-extension/
  manifest.json
  assets/
    logo.svg
  background/
    service_worker.js
  content/
    content.css
    contentScript.js
    extractor.js
    highlighter.js
  panel/
    panel.css
    panel.html
    panel.js
  popup/
    popup.css
    popup.html
    popup.js
```

## What It Does

- Extracts visible webpage headings, paragraphs, blockquotes, and useful list items.
- Ignores scripts, hidden content, navigation, ads, share widgets, forms, and page chrome.
- Sends extracted text to `POST http://localhost:8000/analyze`.
- Displays credibility score, risk level, model confidence, explanation summary, processing time, and highlight count in the popup.
- Highlights suspicious text directly on the page:
  - Emotional language: yellow
  - Clickbait: red
  - ALL CAPS and repeated punctuation: orange
- Opens a full analysis page with breakdowns, explanation items, rewrite suggestions, improvement summary, and analyzed excerpt.
- Stores the latest analysis per tab with `chrome.storage.local`.

## Install Locally

1. Start the backend API.

   ```bash
   cd backend
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. Open Chrome and go to `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the `chrome-extension` folder.
6. Open any regular `http` or `https` webpage.
7. Click the extension icon, then click `Analyze This Page`.

## Backend URL

The default API base URL is:

```text
http://localhost:8000
```

You can change it from the popup under `Backend settings`. The manifest currently grants backend host access for `localhost:8000` and `127.0.0.1:8000`. If you move the API to a different host, add that host to `host_permissions` in `manifest.json`.

## Notes

- The extension uses the existing backend response shape and does not duplicate model logic.
- Very long pages are trimmed to 12,000 characters before analysis to keep the browser responsive.
- Chrome internal pages, the Chrome Web Store, local files, and extension pages cannot be analyzed by content scripts.
