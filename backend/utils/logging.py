import logging
import sys
from pathlib import Path

LOGGER_NAME = "opentranslator"


def setup_logging(level: int = logging.INFO) -> logging.Logger:
    logger = logging.getLogger(LOGGER_NAME)
    logger.setLevel(level)

    if not logger.handlers:
        fmt = logging.Formatter(
            "[%(asctime)s] [%(levelname)s] %(name)s: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )

        sh = logging.StreamHandler(sys.stdout)
        sh.setFormatter(fmt)
        logger.addHandler(sh)

        try:
            from logging.handlers import RotatingFileHandler
            log_dir = Path("logs")
            log_dir.mkdir(exist_ok=True)
            fh = RotatingFileHandler(log_dir / "opentranslator.log", maxBytes=10*1024*1024, backupCount=3, encoding="utf-8")
            fh.setFormatter(fmt)
            logger.addHandler(fh)
        except Exception:
            pass

    return logger


def get_logger() -> logging.Logger:
    return logging.getLogger(LOGGER_NAME)
