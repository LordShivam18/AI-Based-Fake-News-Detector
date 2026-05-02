# AI Trust Engine

Phase 1 MVP misinformation detection system.

## Folder Structure

```text
backend/
  app/
    api/
      routes/
        analysis.py
        health.py
    core/
      config.py
      logging.py
    models/
      model_loader.py
    schemas/
      analysis.py
    services/
      explanation_service.py
      inference_service.py
      assistant_service.py
      report_store.py
      url_extraction_service.py
    utils/
    main.py
  requirements.txt
frontend/
  src/
    App.jsx
    main.jsx
    styles.css
  index.html
  package-lock.json
  package.json
  postcss.config.js
  tailwind.config.js
```

## Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The first backend startup downloads the pretrained HuggingFace model. By default,
Phase 1 uses `hamzab/roberta-fake-news-classification` and combines the model
probability with rule-based credibility penalties.

Health check:

```powershell
curl http://localhost:8000/health
```

Analyze text:

```powershell
curl -X POST http://localhost:8000/analyze `
  -H "Content-Type: application/json" `
  -d "{\"text\":\"BREAKING shocking claim!!! Officials reported by Reuters are investigating.\"}"
```

Analyze a URL:

```powershell
curl -X POST http://localhost:8000/analyze `
  -H "Content-Type: application/json" `
  -d "{\"url\":\"https://example.com/news/article\"}"
```

Example response:

```json
{
  "report_id": "a1b2c3d4e5f6",
  "credibility_score": 0.3124,
  "risk_level": "HIGH",
  "model_confidence": 0.9123,
  "explanation": [
    {
      "type": "emotional_language",
      "text": "BREAKING shocking claim!!!",
      "reason": "Emotionally charged wording can make a claim feel persuasive before evidence is evaluated.",
      "impact": "Readers may react emotionally instead of checking whether the claim is supported."
    },
    {
      "type": "all_caps",
      "text": "BREAKING",
      "reason": "ALL CAPS is often used to amplify urgency or alarm rather than add verifiable detail.",
      "impact": "The text can feel alarmist, which may reduce perceived professionalism and reliability."
    },
    {
      "type": "excessive_punctuation",
      "text": "!!!",
      "reason": "Repeated punctuation can signal exaggeration or clickbait framing.",
      "impact": "The claim may appear exaggerated even if parts of it are accurate."
    },
    {
      "type": "clickbait",
      "text": "BREAKING shocking claim!!!",
      "reason": "Clickbait-style phrasing can reduce trust because it prioritizes reaction over evidence.",
      "impact": "The framing can make the content feel optimized for attention rather than accuracy."
    }
  ],
  "breakdown": {
    "language_score": 35,
    "structure_score": 55,
    "source_score": 60,
    "source_note": "Source reference detected, but this tool has not independently verified it."
  },
  "suggested_rewrite": "According to available information, officials reported by Reuters are investigating. Additional context may be needed before drawing a firm conclusion.",
  "suggestions": [
    "Use neutral, specific wording instead of emotional phrases.",
    "Use normal sentence case unless an acronym is required.",
    "Reduce repeated punctuation and let evidence carry the claim."
  ],
  "improvement": {
    "before_score": 0.3124,
    "after_score": 0.5812,
    "change": "HIGH -> MEDIUM"
  },
  "uncertainty_note": "This analysis is based on language patterns and may not reflect factual accuracy.",
  "processing_time_ms": 421,
  "analyzed_text": "BREAKING shocking claim!!! Officials reported by Reuters are investigating.",
  "source_type": "text",
  "source_url": null
}
```

Fetch a shareable report:

```powershell
curl http://localhost:8000/report/a1b2c3d4e5f6
```

Frontend report URL example:

```text
http://localhost:5173/report/a1b2c3d4e5f6
```

Empty input is rejected with a `400` error response.

```powershell
curl -X POST http://localhost:8000/analyze `
  -H "Content-Type: application/json" `
  -d "{\"text\":\"\"}"
```

```json
{
  "error": "Text must not be empty"
}
```

## Frontend

Requires Node `>=20.19.0` or `>=22.12.0`.

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` and make sure the backend is running on `http://localhost:8000`.
