class HTMLExporter:
    def export(self, title: str, chapters: list[dict], segments_by_chapter: list[list[dict]]) -> str:
        parts = [
            "<!DOCTYPE html>",
            '<html lang="en"><head>',
            "<meta charset='utf-8'>",
            f"<title>{title}</title>",
            "<style>",
            "body{max-width:800px;margin:2em auto;padding:0 1em;font-family:Georgia,serif;line-height:1.8;color:#1a1a1a}",
            "h1{text-align:center;font-size:2em;border-bottom:2px solid #333;padding-bottom:0.5em}",
            "h2{font-size:1.4em;margin-top:2em;color:#444}",
            "p{margin:0.3em 0;text-indent:2em}",
            "</style></head><body>",
            f"<h1>{title}</h1>",
        ]

        for i, chapter in enumerate(chapters):
            ch_title = chapter.get("title")
            if not ch_title:
                ch_num = chapter.get("number", i + 1)
                ch_title = f"Chapter {ch_num}"
            parts.append(f"<h2>{ch_title}</h2>")

            for seg in segments_by_chapter[i]:
                translation = seg.get("translation", "").strip()
                if translation:
                    parts.append(f"<p>{translation}</p>")

        parts.append("</body></html>")
        return "\n".join(parts)
