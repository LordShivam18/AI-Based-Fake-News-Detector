# AI Trust Engine

AI Trust Engine is a hackathon-ready AI credibility assistant for reviewing news claims and short articles. It combines a transformer model with explainable rule-based signals to help users spot risky language, rewrite content more neutrally, and share review reports.

## Key Features

- Credibility analysis for pasted text or article URLs.
- Explainability with highlighted risk signals such as emotional language, all caps, clickbait phrasing, repeated punctuation, and missing sources.
- Rewrite suggestions that convert risky wording into a more neutral version.
- Responsible AI notes that frame the score as a review aid, not a factual verdict.
- Shareable report links for demo and review workflows.

## Tech Stack

- Backend: FastAPI, Pydantic, Uvicorn, Transformers, PyTorch
- Frontend: React, Vite, Tailwind CSS
- Model: `hamzab/roberta-fake-news-classification`

## Project Structure

```text
backend/
  app/
    api/routes/
    core/
    models/
    schemas/
    services/
    main.py
  requirements.txt
frontend/
  src/
  index.html
  package.json
  package-lock.json
```

## Run Locally

### Backend

Requires Python 3.10+.

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The first backend startup downloads the Hugging Face model. After the model is cached, the backend can be started offline by setting:

```powershell
$env:TRANSFORMERS_OFFLINE="1"
$env:HF_HUB_OFFLINE="1"
```

Health check:

```powershell
curl http://localhost:8000/health
```

Analyze text:

```powershell
curl -X POST http://localhost:8000/analyze `
  -H "Content-Type: application/json" `
  -d "{\"text\":\"BREAKING shocking claim!!! Officials have not released verified evidence.\"}"
```

Fetch a report:

```powershell
curl http://localhost:8000/report/<report_id>
```

### Frontend

Requires Node 20.19+ or 22.12+.

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` and keep the backend running on `http://localhost:8000`.

For deployed frontend builds, set:

```text
VITE_API_BASE_URL=https://your-backend-url.example
```

## Responsible Use

This project is designed to support human review. Its score reflects model and language-pattern signals, not a definitive truth judgment.
