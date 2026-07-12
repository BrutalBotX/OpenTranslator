from abc import ABC, abstractmethod

PRONOUN_PROXIMITY = 150


def merge_pronoun_issues(issues: list[dict]) -> list[dict]:
    """Merge pronoun issues within PROXIMITY chars into single items."""
    if not issues:
        return issues
    grouped = []
    types_order = []
    type_buckets: dict[str, list[dict]] = {}
    for issue in issues:
        if issue["type"] != "Pronoun":
            grouped.append(issue)
        else:
            q = issue["question"]
            if q not in type_buckets:
                type_buckets[q] = []
                types_order.append(q)
            type_buckets[q].append(issue)

    current_positions: dict[str, int] = {}
    for q in types_order:
        matches = sorted(type_buckets[q], key=lambda x: x.get("position", 0))
        for m in matches:
            last_pos = current_positions.get(q, -PRONOUN_PROXIMITY * 2)
            if m.get("position", 0) - last_pos >= PRONOUN_PROXIMITY:
                grouped.append(m)
                current_positions[q] = m.get("position", 0)

    return grouped


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
