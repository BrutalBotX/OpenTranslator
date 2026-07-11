from datetime import datetime


class EPUBExporter:
    def export(self, title: str, chapters: list[dict], segments_by_chapter: list[list[dict]], novel_id: str = "") -> str:
        text_content = self._build_text(title, chapters, segments_by_chapter)
        return text_content

    def _build_text(self, title: str, chapters: list[dict], segments_by_chapter: list[list[dict]]) -> str:
        lines = [f"# {title}", ""]
        for i, chapter in enumerate(chapters):
            ch_title = chapter.get("title")
            if not ch_title:
                ch_num = chapter.get("number", i + 1)
                ch_title = f"Chapter {ch_num}"
            lines.append(f"## {ch_title}")
            lines.append("")
            for seg in segments_by_chapter[i]:
                translation = seg.get("translation", "").strip()
                if translation:
                    lines.append(translation)
                    lines.append("")
        return "\n".join(lines)
