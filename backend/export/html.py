import html


class HTMLExporter:
    def export(self, title: str, chapters: list[dict], segments_by_chapter: list[list[dict]], include_source: bool = False, show_numbers: bool = False) -> str:
        safe_title = html.escape(title)
        source_style = "color:#888;font-style:italic;font-size:0.9em" if include_source else ""
        parts = [
            "<!DOCTYPE html>",
            '<html lang="en"><head>',
            "<meta charset='utf-8'>",
            f"<title>{safe_title}</title>",
            "<style>",
            "body{max-width:800px;margin:2em auto;padding:0 1em;font-family:Georgia,serif;line-height:1.8;color:#1a1a1a}",
            "h1{text-align:center;font-size:2em;border-bottom:2px solid #333;padding-bottom:0.5em}",
            "h2{font-size:1.4em;margin-top:2em;color:#444}",
            "p{margin:0.3em 0;text-indent:2em}",
            ".source{" + source_style + "}",
            ".seg-num{color:#ccc;font-size:0.8em;font-family:monospace}",
            "</style></head><body>",
            f"<h1>{safe_title}</h1>",
        ]

        for i, chapter in enumerate(chapters):
            ch_title = chapter.get("title")
            if not ch_title:
                ch_num = chapter.get("number", i + 1)
                ch_title = f"Chapter {ch_num}"
            parts.append(f"<h2>{html.escape(ch_title)}</h2>")

            for seg in segments_by_chapter[i]:
                translation = seg.get("translation", "").strip()
                if not translation:
                    continue
                seg_html = ""
                if show_numbers:
                    seg_html += f'<span class="seg-num">#{seg.get("segment_number", "")} </span>'
                seg_html += f"<p>{html.escape(translation)}</p>"
                if include_source:
                    seg_html += f'<p class="source">{html.escape(seg.get("source_text", ""))}</p>'
                parts.append(seg_html)

        parts.append("</body></html>")
        return "\n".join(parts)
