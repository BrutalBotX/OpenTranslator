from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./data/projects/opentranslator.db"
    chroma_persist_dir: str = "./data/chroma"
    backend_port: int = 8712
    primary_llm_provider: str = "ollama"
    primary_llm_model: str = "llama3:70b"
    fallback_llm_provider: Optional[str] = None
    fallback_llm_model: Optional[str] = None

    class Config:
        env_file = ".env"
        env_prefix = "OT_"


settings = Settings()
