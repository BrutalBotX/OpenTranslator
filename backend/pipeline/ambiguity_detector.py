from backend.detectors.registry import DetectorRegistry


class AmbiguityDetector:
    def __init__(self):
        self.registry = DetectorRegistry()

    async def detect_async(self, text: str, context: dict, novel_id: str) -> list[dict]:
        issues = []

        source_lang = context.get("source_lang", "zh")
        detector = self.registry.get_detector(source_lang)

        known_names = [
            c["name"] for c in context.get("characters", [])
        ]

        known_terms = [
            g["source_term"] for g in context.get("glossary", [])
        ]

        if detector:
            issues.extend(detector.detect(text, known_names, known_terms))

        existing_issues = context.get("existing_qa_issues", [])
        resolved_ids = {q.get("id") for q in context.get("resolved_qa", [])}
        for issue in existing_issues:
            if issue["id"] not in resolved_ids:
                issues.append(issue)

        return issues
