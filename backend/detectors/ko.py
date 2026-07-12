import re

from backend.detectors.base import BaseDetector

HONORIFIC_PATTERNS_KO = [
    (r"(?:님|씨|군|양|님께서|께서|분)", "Honorific detected. Decide how to handle in translation."),
]

class KoreanDetector(BaseDetector):
    def detect(self, text: str, known_names: list[str], known_terms: list[str]) -> list[dict]:
        issues = []

        for pattern, question in HONORIFIC_PATTERNS_KO:
            for match in re.finditer(pattern, text):
                pos = match.start()
                issues.append({
                    "type": "Cultural",
                    "question": question,
                    "context": text[max(0, pos - 20):pos + 20],
                    "suggestions": ["Keep Korean honorific", "Adapt to English formality", "Drop honorific"],
                    "position": pos
                })

        return issues
