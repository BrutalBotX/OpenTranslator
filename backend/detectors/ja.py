import re

from backend.detectors.base import BaseDetector

HONORIFIC_PATTERNS = [
    (r"(?:さん|様|君|ちゃん|殿|先生|先輩|後輩|師匠|兄さん|姉さん)", "Honorific detected. Decide whether to keep or translate."),
    (r"(?:〜さん|〜様|〜君|〜ちゃん)", "Named honorific detected. Check name."),
]

PRONOUN_PATTERNS_JA = [
    (r"彼(?=が|は|を|に|の|も)", "Pronoun 彼 (kare/he) detected. Check referent."),
    (r"彼女(?=が|は|を|に|の|も)", "Pronoun 彼女 (kanojo/she) detected. Check referent."),
]


class JapaneseDetector(BaseDetector):
    def detect(self, text: str, known_names: list[str], known_terms: list[str]) -> list[dict]:
        issues = []

        for pattern, question in HONORIFIC_PATTERNS:
            for match in re.finditer(pattern, text):
                pos = match.start()
                issues.append({
                    "type": "Cultural",
                    "question": question,
                    "context": text[max(0, pos - 20):pos + 20],
                    "suggestions": ["Keep original", "Translate meaning", "Adapt to target culture"],
                    "position": pos
                })

        for pattern, question in PRONOUN_PATTERNS_JA:
            for match in re.finditer(pattern, text):
                pos = match.start()
                issues.append({
                    "type": "Pronoun",
                    "question": question,
                    "context": text[max(0, pos - 20):pos + 20],
                    "suggestions": [],
                    "position": pos
                })

        return issues
