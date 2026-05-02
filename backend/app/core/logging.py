import logging

LOG_FORMAT = "%(asctime)s %(levelname)s [%(name)s] %(message)s"

logger = logging.getLogger("ai_trust_engine")


def configure_logging() -> None:
    logging.basicConfig(level=logging.INFO, format=LOG_FORMAT)
