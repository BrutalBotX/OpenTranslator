from backend.llm.router import LLMRouter
from backend.llm.prompts import TranslationPrompt


class Translator:
    def __init__(self):
        self.router = LLMRouter()
        self.prompt_builder = TranslationPrompt()

    async def translate(self, text: str, context: dict, is_batch: bool = False) -> str:
        system_prompt = self.prompt_builder.build_system(context)

        if is_batch:
            user_prompt = text
        else:
            user_prompt = self.prompt_builder.build_user(text, context)

        response = await self.router.complete(
            prompt=user_prompt,
            system_prompt=system_prompt,
            task="translate",
            context_length=len(system_prompt) + len(user_prompt)
        )

        return response.strip()
