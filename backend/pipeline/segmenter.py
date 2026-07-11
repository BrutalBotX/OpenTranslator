import re


class Segmenter:
    def chunk(self, text: str, max_chars: int = 1200) -> list[str]:
        paragraphs = text.split("\n")
        chunks = []
        current = ""

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            if len(current) + len(para) > max_chars and current:
                chunks.append(current.strip())
                current = para
            else:
                if current:
                    current += "\n" + para
                else:
                    current = para

        if current:
            chunks.append(current.strip())

        return chunks if chunks else [text]

    def split_sentences(self, text: str, lang: str = "zh") -> list[str]:
        if lang in ("zh", "ja"):
            sentences = re.split(r"([。！？\n])", text)
        elif lang == "ko":
            sentences = re.split(r"([.！？\n])", text)
        else:
            sentences = re.split(r"([.!?\n])", text)

        result = []
        buffer = ""
        for part in sentences:
            buffer += part
            if part in ("。", "！", "？", ".", "!", "?", "\n"):
                result.append(buffer.strip())
                buffer = ""
        if buffer.strip():
            result.append(buffer.strip())
        return result
