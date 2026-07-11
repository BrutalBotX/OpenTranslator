import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
import httpx

from backend.db.database import get_session
from backend.db.models import Setting

router = APIRouter()

ALL_PROVIDERS = [
    "ollama", "openai", "deepseek", "anthropic", "google-gemini",
    "groq", "mistral", "together", "perplexity", "cohere",
    "opencode", "opencode-go", "xai", "openrouter", "fireworks", "deepinfra", "custom",
]

PROVIDER_BASE_URLS = {
    "ollama": "http://localhost:11434",
    "openai": "https://api.openai.com/v1",
    "deepseek": "https://api.deepseek.com/v1",
    "anthropic": "https://api.anthropic.com",
    "google-gemini": "https://generativelanguage.googleapis.com",
    "groq": "https://api.groq.com/openai/v1",
    "mistral": "https://api.mistral.ai/v1",
    "together": "https://api.together.xyz/v1",
    "perplexity": "https://api.perplexity.ai",
    "cohere": "https://api.cohere.com/v1",
    "opencode": "https://opencode.ai/zen/v1",
    "opencode-go": "https://opencode.ai/zen/go/v1",
    "xai": "https://api.x.ai/v1",
    "openrouter": "https://openrouter.ai/api/v1",
    "fireworks": "https://api.fireworks.ai/inference/v1",
    "deepinfra": "https://api.deepinfra.com/v1/openai",
}

PROVIDER_REQUIRES_KEY = {
    "ollama": False,
    "openrouter": "Translation only (model list is free)",
    "deepinfra": "Translation only (model list is free)",
}

PROVIDER_PRICING = {
    "ollama": "Free · Local",
    "openai": "Paid",
    "deepseek": "Paid",
    "anthropic": "Paid",
    "google-gemini": "Paid · Free tier",
    "groq": "Paid",
    "mistral": "Paid",
    "together": "Paid",
    "perplexity": "Paid",
    "cohere": "Paid · Free tier",
    "opencode": "Paid · Aggregator",
    "opencode-go": "Paid · Subscription",
    "xai": "Paid",
    "openrouter": "Paid · Aggregator",
    "fireworks": "Paid",
    "deepinfra": "Paid",
    "custom": "Varies",
}

PROVIDER_LABELS = {
    "ollama": "Ollama (Local)",
    "openai": "OpenAI",
    "deepseek": "DeepSeek",
    "anthropic": "Anthropic",
    "google-gemini": "Google Gemini",
    "groq": "Groq",
    "mistral": "Mistral",
    "together": "Together AI",
    "perplexity": "Perplexity",
    "cohere": "Cohere",
    "opencode": "OpenCode Zen",
    "opencode-go": "OpenCode Go",
    "xai": "xAI",
    "openrouter": "OpenRouter",
    "fireworks": "Fireworks AI",
    "deepinfra": "Deep Infra",
    "custom": "Custom Endpoint",
}

SETTINGS_DEFAULTS = {
    "primary_provider": "ollama",
    "primary_model": "llama3:70b",
    "primary_base_url": "",
    "primary_api_key": "",
    "fallback_provider": "",
    "fallback_model": "",
    "fallback_base_url": "",
    "fallback_api_key": "",
    "default_source_lang": "zh",
    "default_target_lang": "en",
    "default_project_dir": "",
    "batch_size": "4",
    "llm_timeout": "60",
}

SETTINGS_META = {
    "primary_provider": {"label": "Primary Provider", "type": "select", "options": ALL_PROVIDERS, "labels": PROVIDER_LABELS},
    "primary_model": {"label": "Primary Model", "type": "text"},
    "primary_base_url": {"label": "Primary API URL", "type": "text"},
    "primary_api_key": {"label": "Primary API Key", "type": "password"},
    "fallback_provider": {"label": "Fallback Provider", "type": "select", "options": ["", *ALL_PROVIDERS], "labels": {"": "(none)", **PROVIDER_LABELS}},
    "fallback_model": {"label": "Fallback Model", "type": "text"},
    "fallback_base_url": {"label": "Fallback API URL", "type": "text"},
    "fallback_api_key": {"label": "Fallback API Key", "type": "password"},
    "default_source_lang": {"label": "Source Language", "type": "select", "options": ["zh", "ja", "ko"], "labels": {"zh": "Chinese", "ja": "Japanese", "ko": "Korean"}},
    "default_target_lang": {"label": "Target Language", "type": "select", "options": ["en"], "labels": {"en": "English"}},
    "default_project_dir": {"label": "Default Project Directory", "type": "directory"},
    "batch_size": {"label": "Segments per LLM call", "type": "range", "min": 1, "max": 10, "step": 1, "warning_above": 6,
        "description": "Higher = faster but may affect quality. 4 is recommended. 8+ may cause issues."},
    "llm_timeout": {"label": "LLM Timeout (seconds)", "type": "range", "min": 10, "max": 300, "step": 5,
        "description": "Max seconds to wait for an LLM response before aborting. 60s is recommended for most providers."},
}

_cache: dict[str, str] | None = None


def get_cached(key: str, default: str = "") -> str:
    if _cache is not None:
        return _cache.get(key, default)
    return SETTINGS_DEFAULTS.get(key, default)


async def _load(session: AsyncSession) -> dict[str, str]:
    global _cache
    if _cache is not None:
        return _cache
    result = await session.execute(select(Setting))
    rows = result.scalars().all()
    _cache = dict(SETTINGS_DEFAULTS)
    for row in rows:
        _cache[row.key] = row.value
    return _cache


async def _save(key: str, value: str, session: AsyncSession):
    global _cache
    if _cache is None:
        _cache = dict(SETTINGS_DEFAULTS)
    _cache[key] = value
    row = await session.get(Setting, key)
    if row:
        row.value = value
    else:
        session.add(Setting(key=key, value=value))
    await session.commit()


async def load_cache():
    """Load settings into cache at startup. Called from main.py."""
    global _cache
    from backend.db.database import async_session
    async with async_session() as session:
        _cache = dict(SETTINGS_DEFAULTS)
        result = await session.execute(select(Setting))
        for row in result.scalars().all():
            _cache[row.key] = row.value


def reset_cache():
    """Reset cache so next get_cached() returns defaults."""
    global _cache
    _cache = None


@router.get("/settings")
async def get_settings(session: AsyncSession = Depends(get_session)):
    values = await _load(session)
    return {
        "values": values,
        "meta": SETTINGS_META,
        "requires_key": PROVIDER_REQUIRES_KEY,
        "pricing": PROVIDER_PRICING,
    }


class SettingsUpdate(BaseModel):
    values: dict[str, str]


@router.put("/settings")
async def update_settings(data: SettingsUpdate, session: AsyncSession = Depends(get_session)):
    for key, value in data.values.items():
        if key in SETTINGS_DEFAULTS:
            await _save(key, value, session)
    return {"saved": True}


@router.get("/settings/llm-config")
async def get_llm_config(session: AsyncSession = Depends(get_session)):
    values = await _load(session)

    default_models = {
        "ollama": "llama3:70b", "openai": "gpt-4o", "deepseek": "deepseek-chat",
        "anthropic": "claude-sonnet-4-20250514", "google-gemini": "gemini-2.0-flash",
        "groq": "llama-3.3-70b-versatile", "mistral": "mistral-large-latest",
        "together": "meta-llama/llama-3.3-70b-instruct-turbo", "perplexity": "sonar-pro",
        "cohere": "command-r-plus", "opencode": "openai/deepseek-v4-pro", "opencode-go": "openai/deepseek-v4-pro",
        "xai": "grok-2", "openrouter": "openai/gpt-4o",
        "fireworks": "accounts/fireworks/models/qwen3-70b",
        "deepinfra": "meta-llama/llama-3.3-70b-instruct",
    }

    def resolve_model(provider: str, model: str) -> str:
        return model if model else default_models.get(provider, "")

    primary_provider = values.get("primary_provider", "ollama")
    primary_model = resolve_model(primary_provider, values.get("primary_model", ""))
    fallback_provider = values.get("fallback_provider") or None
    fallback_model = resolve_model(fallback_provider or "", values.get("fallback_model", "")) if fallback_provider else None

    return {
        "primary": {
            "provider": primary_provider,
            "model": primary_model,
            "base_url": values.get("primary_base_url") or None,
            "api_key": values.get("primary_api_key") or None,
        },
        "fallback": {
            "provider": fallback_provider,
            "model": fallback_model,
            "base_url": values.get("fallback_base_url") or None,
            "api_key": values.get("fallback_api_key") or None,
        },
    }


@router.get("/settings/models")
async def fetch_models(provider: str = "", base_url: str = "", api_key: str = ""):
    if not provider:
        return {"models": []}

    resolved_base = base_url or PROVIDER_BASE_URLS.get(provider, "")
    if not resolved_base:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")

    if provider == "ollama":
        url = f"{resolved_base}/api/tags"
    elif provider == "google-gemini":
        url = f"{resolved_base}/v1beta/models"
    elif provider == "anthropic":
        url = f"{resolved_base}/v1/models"
    elif provider == "perplexity":
        url = f"{resolved_base}/models"
    else:
        url = f"{resolved_base}/models"

    headers = {"Content-Type": "application/json"}
    if api_key:
        if provider == "google-gemini":
            url = f"{url}?key={api_key}"
        elif provider == "anthropic":
            headers["x-api-key"] = api_key
            headers["anthropic-version"] = "2023-06-01"
        else:
            headers["Authorization"] = f"Bearer {api_key}"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            ct = resp.headers.get("content-type", "")
            if "application/json" not in ct and "application/x-ndjson" not in ct:
                text = resp.text[:200]
                return {"models": [], "error": f"Expected JSON but got '{ct}': {text}"}
            data = resp.json()
    except httpx.TimeoutException:
        return {"models": [], "error": "Connection timed out"}
    except httpx.HTTPStatusError as e:
        text = e.response.text[:200]
        ct = e.response.headers.get("content-type", "")
        return {"models": [], "error": f"HTTP {e.response.status_code} ({ct}): {text}"}
    except json.JSONDecodeError:
        return {"models": [], "error": "Invalid JSON response from provider API"}
    except Exception as e:
        return {"models": [], "error": str(e)}

    models = []
    if provider == "ollama":
        for m in data.get("models", []):
            name = m.get("name", "")
            if name:
                models.append({"id": name, "name": name})
    elif provider == "google-gemini":
        for m in data.get("models", []):
            name = m.get("name", "").replace("models/", "")
            if name and "gemini" in name.lower():
                models.append({"id": name, "name": name})
    elif provider == "anthropic":
        for m in data.get("data", []):
            name = m.get("id", "")
            if name:
                models.append({"id": name, "name": name})
    else:
        for m in data.get("data", []):
            name = m.get("id", "")
            if name:
                models.append({"id": name, "name": name})

    return {"models": sorted(models, key=lambda x: x["id"])}
