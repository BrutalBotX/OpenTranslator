import re
from pypinyin import pinyin, Style

CJK_RANGE = re.compile(r"[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]")

BASIC_JA_ROMAJI = {
    "あ": "a", "い": "i", "う": "u", "え": "e", "お": "o",
    "か": "ka", "き": "ki", "く": "ku", "け": "ke", "こ": "ko",
    "さ": "sa", "し": "shi", "す": "su", "せ": "se", "そ": "so",
    "た": "ta", "ち": "chi", "つ": "tsu", "て": "te", "と": "to",
    "な": "na", "に": "ni", "ぬ": "nu", "ね": "ne", "の": "no",
    "は": "ha", "ひ": "hi", "ふ": "fu", "へ": "he", "ほ": "ho",
    "ま": "ma", "み": "mi", "む": "mu", "め": "me", "も": "mo",
    "や": "ya", "ゆ": "yu", "よ": "yo",
    "ら": "ra", "り": "ri", "る": "ru", "れ": "re", "ろ": "ro",
    "わ": "wa", "を": "wo", "ん": "n",
    "が": "ga", "ぎ": "gi", "ぐ": "gu", "げ": "ge", "ご": "go",
    "ざ": "za", "じ": "ji", "ず": "zu", "ぜ": "ze", "ぞ": "zo",
    "だ": "da", "ぢ": "ji", "づ": "zu", "で": "de", "ど": "do",
    "ば": "ba", "び": "bi", "ぶ": "bu", "べ": "be", "ぼ": "bo",
    "ぱ": "pa", "ぴ": "pi", "ぷ": "pu", "ぺ": "pe", "ぽ": "po",
    "きゃ": "kya", "きゅ": "kyu", "きょ": "kyo",
    "しゃ": "sha", "しゅ": "shu", "しょ": "sho",
    "ちゃ": "cha", "ちゅ": "chu", "ちょ": "cho",
    "にゃ": "nya", "にゅ": "nyu", "にょ": "nyo",
    "ひゃ": "hya", "ひゅ": "hyu", "ひょ": "hyo",
    "みゃ": "mya", "みゅ": "myu", "みょ": "myo",
    "りゃ": "rya", "りゅ": "ryu", "りょ": "ryo",
    "ぎゃ": "gya", "ぎゅ": "gyu", "ぎょ": "gyo",
    "じゃ": "ja", "じゅ": "ju", "じょ": "jo",
    "びゃ": "bya", "びゅ": "byu", "びょ": "byo",
    "ぴゃ": "pya", "ぴゅ": "pyu", "ぴょ": "pyo",
}

HANGUL_BASIC = {
    "가": "ga", "나": "na", "다": "da", "라": "ra", "마": "ma",
    "바": "ba", "사": "sa", "아": "a", "자": "ja", "차": "cha",
    "카": "ka", "타": "ta", "파": "pa", "하": "ha",
}


def transliterate_zh(text: str) -> str:
    if not CJK_RANGE.search(text):
        return ""
    try:
        result = pinyin(text, style=Style.TONE3, neutral_tone_with_five=True)
        return " ".join(item[0] for item in result)
    except Exception:
        return ""


def transliterate_ja(text: str) -> str:
    result = []
    for ch in text:
        if ch in BASIC_JA_ROMAJI:
            result.append(BASIC_JA_ROMAJI[ch])
        elif CJK_RANGE.match(ch):
            result.append(ch)
        else:
            result.append(ch)
    return " ".join(result)


def transliterate_ko(text: str) -> str:
    result = []
    for ch in text:
        if ch in HANGUL_BASIC:
            result.append(HANGUL_BASIC[ch])
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
