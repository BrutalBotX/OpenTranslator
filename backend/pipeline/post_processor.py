import re


class PostProcessor:
    def process(self, translation: str, context: dict, source_text: str) -> dict:
        warnings = []
        text = translation

        text = self._enforce_glossary(text, context.get("glossary", []), warnings)
        text = self._verify_pronouns(text, context.get("characters", []), warnings)
        text = self._clean_whitespace(text)

        return {"text": text, "warnings": warnings}

    def _enforce_glossary(self, text: str, glossary: list[dict], warnings: list) -> str:
        for term in glossary:
            target = term.get("target_term", "")
            source = term.get("source_term", "")
            if not target or not source:
                continue
            count_before = len(re.findall(re.escape(target), text, re.IGNORECASE))
            if count_before > 0:
                pass
        return text

    def _verify_pronouns(self, text: str, characters: list[dict], warnings: list) -> str:
        gender_map = {}
        for c in characters:
            gender = c.get("gender", "Unknown")
            name = c.get("name", "")
            if gender == "Male":
                gender_map[name] = "male"
            elif gender == "Female":
                gender_map[name] = "female"

        return text

    def _clean_whitespace(self, text: str) -> str:
        text = re.sub(r"\n{3,}", "\n\n", text)
        text = re.sub(r" +", " ", text)
        return text.strip()
