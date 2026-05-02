import os

from dotenv import load_dotenv

load_dotenv()

API_TITLE = "AI Trust Engine API"
API_VERSION = "0.1.0"

MODEL_NAME = os.getenv(
    "MODEL_NAME",
    "distilbert-base-uncased-finetuned-sst-2-english",
)

CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
