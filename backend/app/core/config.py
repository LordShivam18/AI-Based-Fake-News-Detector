import os

from dotenv import load_dotenv

load_dotenv()

API_TITLE = "AI Trust Engine API"
API_VERSION = "0.1.0"

MODEL_NAME = os.getenv(
    "MODEL_NAME",
    "hamzab/roberta-fake-news-classification",
)

MODEL_INPUT_TEMPLATE = os.getenv(
    "MODEL_INPUT_TEMPLATE",
    "<title> User submitted content <content> {text} <end>",
)
MODEL_TIMEOUT_SECONDS = float(os.getenv("MODEL_TIMEOUT_SECONDS", "12"))

CORS_ORIGINS = ["*"]
