from litellm import acompletion

from backend.llm.providers import ProviderConfig
from backend.api.settings import get_cached


class LLMRouter:
    def __init__(self):
        self.provider_config = ProviderConfig()

    async def complete(
        self,
        prompt: str,
        system_prompt: str,
        task: str = "translate",
        context_length: int = 0,
        temperature: float = 0.3
    ) -> str:
        provider = self._select_provider(task, context_length)
        model = provider["model"]
        base_url = provider.get("base_url") or None
        api_key = provider.get("api_key") or None
        timeout = int(get_cached("llm_timeout", "60"))

        response = await acompletion(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            temperature=temperature,
            max_tokens=4096,
            base_url=base_url,
            api_key=api_key,
            timeout=timeout,
        )

        return response.choices[0].message.content

    def _select_provider(self, task: str, context_length: int) -> dict:
        provider = self.provider_config.get_primary()

        if context_length > 8000 and provider.get("name") == "ollama":
            fallback = self.provider_config.get_fallback()
            if fallback:
                return fallback

        return provider

    async def complete_with_fallback(
        self,
        prompt: str,
        system_prompt: str,
        task: str = "translate"
    ) -> str:
        try:
            return await self.complete(prompt, system_prompt, task)
        except Exception:
            fallback = self.provider_config.get_fallback()
            if fallback:
                fallback_model = fallback["model"]
                fb_base_url = fallback.get("base_url") or None
                fb_api_key = fallback.get("api_key") or None
                timeout = int(get_cached("llm_timeout", "60"))
                response = await acompletion(
                    model=fallback_model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.3,
                    max_tokens=4096,
                    base_url=fb_base_url,
                    api_key=fb_api_key,
                    timeout=timeout,
                )
                return response.choices[0].message.content
            raise
