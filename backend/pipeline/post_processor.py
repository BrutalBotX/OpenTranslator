import re
from backend.utils.logging import get_logger

log = get_logger()


class PostProcessor:
    def process(self, translation: str, context: dict, source_text: str) -> dict:
        warnings = []
        text = translation

        text = self._check_glossary(text, context.get("glossary", []), warnings)
        text = self._clean_whitespace(text)

        return {"text": text, "warnings": warnings}

    def _check_glossary(self, text: str, glossary: list[dict], warnings: list) -> str:
        for term in glossary:
            target = term.get("target_term", "")
            source = term.get("source_term", "")
            if not target or not source:
                continue
            if source.lower() in text.lower():
                warnings.append(
                    f"Source term '{source}' found in translation — expected '{target}'. "
                    f"Add to glossary or use 'Apply' to re-translate."
                )
        return text

    def _clean_whitespace(self, text: str) -> str:
        text = re.sub(r"\n{3,}", "\n\n", text)
        text = re.sub(r" +", " ", text)
        return text.strip()
