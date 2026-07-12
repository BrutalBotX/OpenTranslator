from typing import Optional
from backend.api.settings import get_cached

DEFAULT_MODELS = {
    "ollama": "llama3:70b",
    "openai": "gpt-4o",
    "deepseek": "deepseek-chat",
    "anthropic": "claude-sonnet-4-20250514",
    "google-gemini": "gemini-2.0-flash",
    "groq": "llama-3.3-70b-versatile",
    "mistral": "mistral-large-latest",
    "together": "meta-llama/llama-3.3-70b-instruct-turbo",
    "perplexity": "sonar-pro",
    "cohere": "command-r-plus",
    "opencode": "openai/deepseek-v4-pro",
    "opencode-go": "openai/deepseek-v4-pro",
    "xai": "grok-2",
    "openrouter": "openai/gpt-4o",
    "fireworks": "accounts/fireworks/models/qwen3-70b",
    "deepinfra": "meta-llama/llama-3.3-70b-instruct",
}


class ProviderConfig:
    KNOWN_PROVIDERS = {
        "openai": {"base_url": "https://api.openai.com/v1", "max_context": 128000},
        "deepseek": {"base_url": "https://api.deepseek.com/v1", "max_context": 64000},
        "anthropic": {"base_url": "https://api.anthropic.com/v1", "max_context": 100000},
        "google-gemini": {"base_url": "https://generativelanguage.googleapis.com/v1beta", "max_context": 128000},
        "groq": {"base_url": "https://api.groq.com/openai/v1", "max_context": 32000},
        "mistral": {"base_url": "https://api.mistral.ai/v1", "max_context": 32000},
        "together": {"base_url": "https://api.together.xyz/v1", "max_context": 64000},
        "perplexity": {"base_url": "https://api.perplexity.ai", "max_context": 32000},
        "cohere": {"base_url": "https://api.cohere.com/v1", "max_context": 64000},
        "opencode": {"base_url": "https://opencode.ai/zen/v1", "max_context": 128000},
        "opencode-go": {"base_url": "https://opencode.ai/zen/go/v1", "max_context": 128000},
        "xai": {"base_url": "https://api.x.ai/v1", "max_context": 128000},
        "openrouter": {"base_url": "https://openrouter.ai/api/v1", "max_context": 64000},
        "fireworks": {"base_url": "https://api.fireworks.ai/inference/v1", "max_context": 64000},
        "deepinfra": {"base_url": "https://api.deepinfra.com/v1/openai", "max_context": 64000},
        "ollama": {"base_url": "http://localhost:11434/v1", "max_context": 8192},
    }

    def get_primary(self) -> dict:
        provider = get_cached("primary_provider", "ollama")
        model = get_cached("primary_model", "")
        base_url = get_cached("primary_base_url", "")
        api_key = get_cached("primary_api_key", "")
        known = self.KNOWN_PROVIDERS.get(provider, {})

        if not model:
            model = DEFAULT_MODELS.get(provider, "")

        return {
            "name": provider,
            "model": model,
            "base_url": base_url or known.get("base_url", ""),
            "api_key": api_key or None,
            "max_context": known.get("max_context", 8192),
        }

    def get_fallback(self) -> Optional[dict]:
        provider = get_cached("fallback_provider")
        if not provider:
            return None
        model = get_cached("fallback_model", "")
        base_url = get_cached("fallback_base_url", "")
        api_key = get_cached("fallback_api_key", "")
        known = self.KNOWN_PROVIDERS.get(provider, {})

        if not model:
            model = DEFAULT_MODELS.get(provider, "")

        return {
            "name": provider,
            "model": model,
            "base_url": base_url or known.get("base_url", ""),
            "api_key": api_key or None,
            "max_context": known.get("max_context", 128000),
        }


