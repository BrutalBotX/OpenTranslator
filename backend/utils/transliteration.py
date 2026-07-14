import re
from pypinyin import lazy_pinyin, Style

CJK_RANGE = re.compile(r"[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]")

_MALE_INDICATORS = {"伟", "强", "明", "龙", "刚", "浩", "军", "勇", "飞", "超", "杰", "涛", "斌", "磊", "峰"}
_FEMALE_INDICATORS = {"美", "丽", "芳", "娟", "静", "琳", "婷", "娜", "洁", "萍", "雪", "瑶", "玲", "婷", "霞", "敏"}

COMMON_SURNAMES = {
    "李", "王", "张", "刘", "陈", "杨", "赵", "黄", "周", "吴",
    "徐", "孙", "胡", "朱", "高", "林", "何", "郭", "马", "罗",
    "梁", "宋", "郑", "谢", "韩", "唐", "冯", "于", "董", "萧",
    "程", "曹", "袁", "邓", "许", "傅", "沈", "曾", "彭", "吕",
}


def transliterate_zh(text: str) -> str:
    if not CJK_RANGE.search(text):
        return ""
    try:
        parts = re.split(r'([\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+)', text)
        result = []
        for part in parts:
            if CJK_RANGE.fullmatch(part):
                result.append(" ".join(lazy_pinyin(part, style=Style.TONE)))
            else:
                result.append(part)
        return "".join(result).strip()
    except Exception:
        return ""


def _ja_romaji(text: str) -> str:
    try:
        import pykakasi
        kks = pykakasi.kakasi()
        result = kks.convert(text)
        return " ".join(item["hepburn"] for item in result)
    except Exception:
        return ""


def transliterate_ja(text: str) -> str:
    if not CJK_RANGE.search(text) and not any("\u3040" <= c <= "\u30ff" for c in text):
        return ""
    return _ja_romaji(text)


def transliterate_ko(text: str) -> str:
    result = []
    for ch in text:
        if "\uac00" <= ch <= "\ud7af":
            try:
                import unicodedata
                name = unicodedata.name(ch, "")
                parts = name.replace("HANGUL SYLLABLE ", "").split()
                if parts:
                    result.append(parts[0].lower())
                else:
                    result.append(ch)
            except Exception:
                result.append(ch)
        elif CJK_RANGE.match(ch):
            result.append(ch)
        else:
            result.append(ch)
    return " ".join(result)


def transliterate(text: str, source_lang: str) -> str:
    if not text or not source_lang:
        return ""
    source_lang = source_lang.lower()
    if source_lang == "zh":
        return transliterate_zh(text)
    elif source_lang == "ja":
        return transliterate_ja(text)
    elif source_lang == "ko":
        return transliterate_ko(text)
    return ""


_MALE_REASONS = {
    "伟": "伟 (wěi — great/mighty)",
    "强": "强 (qiáng — strong)",
    "明": "明 (míng — bright)",
    "龙": "龙 (lóng — dragon)",
    "刚": "刚 (gāng — firm/steel)",
    "浩": "浩 (hào — vast)",
    "军": "军 (jūn — military)",
    "勇": "勇 (yǒng — brave)",
    "飞": "飞 (fēi — flying)",
    "超": "超 (chāo — surpass)",
    "杰": "杰 (jié — outstanding)",
    "涛": "涛 (tāo — great wave)",
    "斌": "斌 (bīn — refined/cultured)",
    "磊": "磊 (lěi — open-hearted)",
    "峰": "峰 (fēng — peak/mountain)",
}
_FEMALE_REASONS = {
    "美": "美 (měi — beautiful)",
    "丽": "丽 (lì — lovely)",
    "芳": "芳 (fāng — fragrant)",
    "娟": "娟 (juān — graceful)",
    "静": "静 (jìng — serene/quiet)",
    "琳": "琳 (lín — jade/gem)",
    "婷": "婷 (tíng — graceful)",
    "娜": "娜 (nà — elegant)",
    "洁": "洁 (jié — pure/clean)",
    "萍": "萍 (píng — duckweed/drifting)",
    "雪": "雪 (xuě — snow)",
    "瑶": "瑶 (yáo — precious jade)",
    "玲": "玲 (líng — tinkling jade)",
    "霞": "霞 (xiá — rosy clouds)",
    "敏": "敏 (mǐn — quick/clever)",
}


def suggest_gender(name: str) -> str | None:
    result = infer_gender(name)
    return result["gender"] if result else None


def infer_gender(name: str) -> dict | None:
    """Returns {"gender": str, "reason": str} or None."""
    if not name or len(name) < 2:
        return None
    if name in COMMON_SURNAMES:
        return None
    last_char = name[-1]
    last_two = name[-2:] if len(name) >= 2 else ""
    if last_char in _FEMALE_INDICATORS:
        hint = _FEMALE_REASONS.get(last_char, f"'{last_char}'")
        return {"gender": "Female", "reason": f"Name ends with {hint} — common female indicator"}
    if last_two in {"子", "儿"}:
        return {"gender": "Female", "reason": f"Name ends with '{last_two}' — common feminine suffix"}
    if last_char in _MALE_INDICATORS:
        hint = _MALE_REASONS.get(last_char, f"'{last_char}'")
        return {"gender": "Male", "reason": f"Name ends with {hint} — common male indicator"}
    return None
