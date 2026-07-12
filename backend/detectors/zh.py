import re
from collections import Counter

from backend.detectors.base import BaseDetector

PRONOUN_RULES = [
    (r"他(?![们属])", "Pronoun '他' (he/him) detected. Which male character does this refer to?"),
    (r"她(?![们属])", "Pronoun '她' (she/her) detected. Which female character does this refer to?"),
    (r"它(?![们属])", "Pronoun '它' (it) detected. Check referent."),
    (r"他们", "Pronoun '他们' (they/them, male/mixed) detected. Which group does this refer to?"),
    (r"她们", "Pronoun '她们' (they/them, female) detected. Which group does this refer to?"),
]

CJK_CHAR = re.compile(r"[\u4e00-\u9fff]")

COMMON_CHENGYU = [
    "画蛇添足", "对牛弹琴", "一石二鸟", "井底之蛙", "守株待兔",
    "亡羊补牢", "掩耳盗铃", "鹤立鸡群", "虎头蛇尾", "杯弓蛇影",
    "狐假虎威", "画龙点睛", "雪中送炭", "锦上添花", "一见钟情",
    "不翼而飞", "半途而废", "一鸣惊人", "三心二意", "七上八下",
]

CULTURE_TERMS = [
    "丹田", "筑基", "金丹", "元婴", "化神", "渡劫", "飞升",
    "灵气", "灵根", "识海", "神识", "法宝", "道侣", "心法",
    "功法", "武技", "内力", "真气", "元神", "炼气", "大乘",
    "合体", "分神", "出窍", "灵兽", "丹药", "阵法", "秘境",
    "轮回", "因果", "业力", "天道", "法则", "混沌", "鸿蒙",
]

class ChineseDetector(BaseDetector):
    def __init__(self):
        self.idiom_set = set(COMMON_CHENGYU)

    def detect(self, text: str, known_names: list[str], known_terms: list[str]) -> list[dict]:
        issues = []

        known_set = set(n.lower() for n in known_names)
        known_terms_set = set(t.lower() for t in known_terms)

        for pattern, question in PRONOUN_RULES:
            for match in re.finditer(pattern, text):
                pos = match.start()
                issues.append({
                    "type": "Pronoun",
                    "question": question,
                    "context": text[max(0, pos - 25):pos + 25],
                    "suggestions": [],
                    "position": pos
                })

        words = list(CJK_CHAR.finditer(text))
        for i in range(len(words) - 3):
            four_chars = text[words[i].start():words[i+3].end()]
            if len(four_chars) == 4 and four_chars in self.idiom_set:
                pos = words[i].start()
                issues.append({
                    "type": "Idiom",
                    "question": f'Idiom "{four_chars}" detected. Best translation approach?',
                    "context": text[max(0, pos - 20):pos + 20],
                    "suggestions": [
                        "Translate meaning literally",
                        "Use equivalent English idiom",
                        "Explain in parentheses",
                    ],
                    "position": pos
                })

        for term in CULTURE_TERMS:
            for match in re.finditer(re.escape(term), text):
                if term.lower() not in known_terms_set:
                    pos = match.start()
                    issues.append({
                        "type": "Cultural",
                        "question": f'Cultivation term "{term}" detected. How to translate?',
                        "context": text[max(0, pos - 15):pos + 15],
                        "suggestions": [
                            f"Keep as pinyin ({term})",
                            f"Translate literally",
                            f"Use established translation if known",
                        ],
                        "position": pos
                    })

        name_candidates = []
        for match in CJK_CHAR.finditer(text):
            for length in (4, 3, 2):
                end = match.start() + length
                if end > len(text):
                    continue
                name = text[match.start():end]
                if not all("\u4e00" <= c <= "\u9fff" for c in name):
                    continue
                if name.lower() in known_set or name.lower() in known_terms_set:
                    continue
                if name in CULTURE_TERMS:
                    continue
                name_candidates.append(name)
                break

        name_counts = Counter(name_candidates)
        name_seen = set()
        for name in name_candidates:
            if name in name_seen:
                continue
            name_seen.add(name)
            if name_counts[name] < 2:
                continue

            suggestions = [
                f"{name} (Male character)",
                f"{name} (Female character)",
                f"{name} (Location/Item/Technique)",
            ]

            for kn in known_names:
                if len(kn) >= 2 and (kn in name or name in kn):
                    suggestions.append(f"Alias of {kn}")
                    break

            issues.append({
                "type": "Name",
                "question": f'New name/term detected: "{name}". Is this a character, alias, or term?',
                "context": "",
                "suggestions": suggestions,
            })

        return issues
