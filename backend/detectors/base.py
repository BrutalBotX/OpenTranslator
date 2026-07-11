from abc import ABC, abstractmethod


class BaseDetector(ABC):
    @abstractmethod
    def detect(self, text: str, known_names: list[str], known_terms: list[str]) -> list[dict]:
        """
        Detect ambiguity issues in the text.

        Returns a list of dicts with:
            - type: str (Pronoun, Name, Idiom, Cultural, Term, Gender)
            - question: str (the question to ask the translator)
            - context: str (surrounding text for reference)
            - suggestions: list[str] (optional suggested answers)
            - position: int (character position in text)
        """
        pass
