class PlainTextExporter:
    def export(self, title: str, chapters: list[dict], segments: list[list[dict]]) -> str:
        lines = [f"# {title}", ""]

        for i, chapter in enumerate(chapters):
            ch_title = chapter.get("title")
            if not ch_title:
                ch_title = f"Chapter {i + 1}"
            lines.append(f"## {ch_title}")
            lines.append("")
            for seg in segments[i] if i < len(segments) else []:
                if seg.get("translation"):
                    lines.append(seg["translation"])
                    lines.append("")

        return "\n".join(lines)
