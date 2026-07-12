from backend.pipeline.context_gatherer import ContextGatherer
from backend.pipeline.ambiguity_detector import AmbiguityDetector
from backend.pipeline.translator import Translator
from backend.pipeline.post_processor import PostProcessor


class TranslationPipeline:
    def __init__(self):
        self.context_gatherer = ContextGatherer()
        self.ambiguity_detector = AmbiguityDetector()
        self.translator = Translator()
        self.post_processor = PostProcessor()

    async def translate(self, source_text: str, chapter_id: str, novel_id: str) -> dict:
        context = await self.context_gatherer.gather_async(
            chapter_id=chapter_id,
            novel_id=novel_id,
            source_text=source_text
        )

        translated = await self.translator.translate(
            text=source_text,
            context=context
        )

        processed = self.post_processor.process(
            translation=translated,
            context=context,
            source_text=source_text
        )

        return {
            "translation": processed["text"],
            "warnings": processed["warnings"],
            "questions_pending": False,
        }
