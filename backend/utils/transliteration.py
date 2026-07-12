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
        return " ".join(lazy_pinyin(text, style=Style.TONE))
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


def suggest_gender(name: str) -> str | None:
    if not name or len(name) < 2:
        return None
    if name in COMMON_SURNAMES or (len(name) <= 2 and name[0] in COMMON_SURNAMES):
        return None
    last_char = name[-1]
    last_two = name[-2:] if len(name) >= 2 else ""
    if last_char in _FEMALE_INDICATORS or last_two in {"子", "儿"}:
        return "Female"
    if last_char in _MALE_INDICATORS:
        return "Male"
    return None
