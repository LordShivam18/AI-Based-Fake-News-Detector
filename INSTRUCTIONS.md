# 🧠 AI Credibility Assistant

An AI-powered system that analyzes content credibility, explains risk factors, and suggests improved, neutral rewrites — designed with responsible AI principles.

---

# 🚀 Overview

This project is a **Credibility Assistant**, not just a fake news detector.

It:

* analyzes content for credibility signals
* explains *why* something may be misleading
* suggests improved, neutral rewrites
* helps users understand and improve content quality

---

# 🎯 Core Features

## 🔍 1. Credibility Analysis

* Accepts text or article input
* Returns a credibility score (0–1)
* Classifies risk level (LOW / MEDIUM / HIGH)

---

## 🧾 2. Explainability Engine

* Highlights suspicious phrases
* Detects:

  * emotional language
  * clickbait patterns
  * excessive punctuation
* Provides **reason + impact** for each issue

---

## 🧠 3. Suggested Rewrite

* Converts content into a more neutral, credible version
* Removes exaggeration and emotional bias

---

## 📊 4. Credibility Breakdown

* Language quality
* Structure quality
* Source reliability (basic heuristic)

---

## 🎯 5. Improvement Tracking

* Shows before vs after credibility
* Example: HIGH → MEDIUM

---

## ⚖️ 6. Responsible AI Layer

* Displays **model confidence (not factual certainty)**
* Includes **uncertainty disclaimer**
* Avoids overclaiming truth

---

## 📤 7. Shareable Reports

* Each analysis generates a report link
* Can be opened and shared

---

# 🏗️ Project Structure

```
backend/
  app/
    api/
    services/
    models/
    schemas/
    core/
    main.py

frontend/
  src/
    App.jsx
```

---

# ⚙️ How to Run

## 🔧 Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate   # (Windows)

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

---

## 🎨 Frontend

```bash
cd frontend
npm install
npm run dev
```

Open:

```
http://localhost:5173
```

---

# 🧪 Demo Flow

1. Click **Try Demo**
2. View:

   * credibility score
   * highlighted issues
   * explanation
3. See:

   * suggested rewrite
   * improvement badge
4. Open shareable report

---

# 🧠 System Behavior

The system:

* analyzes linguistic patterns
* combines model output with rule-based signals
* generates structured explanations
* suggests improvements

It is designed to **assist decision-making**, not replace human judgment.

---

# ⚠️ Important Notes

* This is an AI-assisted system, not a fact-checking authority
* Results are based on patterns, not verified truth
* Always interpret outputs critically

---

# 🔮 Future Upgrades (Team Roadmap)

## 🌐 1. Chrome Extension

* Analyze any webpage instantly
* Highlight suspicious content directly on page
* One-click credibility check

---

## 🧠 2. Advanced Source Verification

* Detect real vs unverified sources
* Cross-reference trusted domains

---

## 🧩 3. Multi-language Support

* Analyze content in multiple languages

---

## 📄 4. Document & Screenshot Analysis

* Upload images or PDFs
* Extract and analyze text

---

## ⚡ 5. Real-time Content Monitoring

* Live detection in feeds or streams

---

## 🎯 6. Enhanced Rewrite Modes

* Neutral rewrite
* Professional rewrite
* Journalistic rewrite

---

# 👥 Team Contribution Guide

From this point forward:

👉 Each team member should:

1. Pull the latest code from GitHub
2. Set up the project locally
3. Understand the structure and flow
4. Pick one feature or upgrade
5. Build independently using AI tools (e.g., Gemini)
6. Integrate changes step-by-step

---

# ⚙️ Development Approach

* Build features incrementally
* Keep components modular
* Do not break existing functionality
* Test before integrating

---

# 🎯 Goal

To evolve this into:

> **A real-world credibility assistant used across platforms to analyze, understand, and improve content quality.**

---

# 📌 Final Note

Focus on:

* usability
* clarity
* real-world application

Avoid:

* unnecessary complexity
* overengineering

---

# 🚀 Let’s Build

