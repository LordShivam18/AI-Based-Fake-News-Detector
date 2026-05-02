# AI Trust Engine

Phase 1 MVP for a SaaS-ready misinformation detection system.

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

The first backend startup downloads the pretrained HuggingFace model.

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

Example response:

```json
{
  "credibility_score": 0.3124,
  "risk_level": "HIGH",
  "explanation": [
    "Emotionally charged language detected",
    "ALL CAPS words detected",
    "Excessive punctuation detected",
    "Possible clickbait pattern"
  ]
}
```

Empty input is rejected by request validation.

```powershell
curl -X POST http://localhost:8000/analyze `
  -H "Content-Type: application/json" `
  -d "{\"text\":\"\"}"
```

## Frontend

Requires Node `>=20.19.0` or `>=22.12.0`.

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` and make sure the backend is running on `http://localhost:8000`.
