import re
from collections import Counter
from typing import List, Tuple

CJK_TOKEN = re.compile(r"[\u4e00-\u9fff]+")
CJK_CHAR = re.compile(r"[\u4e00-\u9fff]")

CULTURE_SET = {
    "丹田", "筑基", "金丹", "元婴", "化神", "渡劫", "飞升",
    "灵气", "灵根", "识海", "神识", "法宝", "道侣", "心法",
    "功法", "武技", "内力", "真气", "元神", "炼气", "大乘",
    "合体", "分神", "出窍", "灵兽", "丹药", "阵法", "秘境",
    "轮回", "因果", "业力", "天道", "法则", "混沌", "鸿蒙",
    "掌门", "长老", "弟子", "师父", "师叔", "师伯", "师兄",
    "师姐", "师弟", "师妹", "宗主", "殿主", "峰主", "岛主",
    "灵魂", "精神", "意念", "意志", "神识", "境界", "领悟",
    "不朽", "永生", "不死", "不灭", "混沌", "鸿蒙", "开天",
    "实力", "修为", "级别", "等级", "段位", "层次", "阶段",
    "大陆", "帝国", "王朝", "皇朝", "神界", "仙界", "魔界",
    "妖界", "冥界", "虚空", "深渊", "混沌", "位面", "世界",
}


COMMON_SURNAMES = {
    "李", "王", "张", "刘", "陈", "杨", "赵", "黄", "周", "吴",
    "徐", "孙", "胡", "朱", "高", "林", "何", "郭", "马", "罗",
    "梁", "宋", "郑", "谢", "韩", "唐", "冯", "于", "董", "萧",
    "程", "曹", "袁", "邓", "许", "傅", "沈", "曾", "彭", "吕",
    "苏", "卢", "蒋", "蔡", "贾", "丁", "魏", "薛", "叶", "阎",
    "余", "潘", "杜", "戴", "夏", "钟", "汪", "田", "任", "姜",
    "范", "方", "石", "姚", "谭", "廖", "邹", "熊", "金", "陆",
    "郝", "孔", "白", "崔", "康", "毛", "邱", "秦", "江", "史",
    "顾", "侯", "邵", "孟", "龙", "万", "段", "漕", "钱", "汤",
    "尹", "黎", "易", "常", "武", "乔", "贺", "赖", "龚", "文",
    "楚", "凤", "花", "月", "雪", "云", "柳", "梅", "兰", "竹",
    "林", "苏", "慕", "容", "司", "徒", "欧", "阳", "诸", "葛",
}


def detect_potential_characters(text: str, existing_names: List[str]) -> List[Tuple[str, int]]:
    existing_lower = set(n.lower() for n in existing_names)

    candidates = Counter()

    for token_match in CJK_TOKEN.finditer(text):
        token = token_match.group()
        token_len = len(token)

        for i in range(token_len):
            for length in (2, 3):
                if i + length > token_len:
                    continue
                name = token[i:i + length]

                if name in CULTURE_SET:
                    continue
                if name.lower() in existing_lower:
                    continue

                is_name = False
                if length == 2:
                    if name[0] in COMMON_SURNAMES:
                        is_name = True
                elif length == 3:
                    if name[0] in COMMON_SURNAMES:
                        is_name = True
                    elif name[:2] in ("慕容", "司徒", "欧阳", "诸葛", "上官", "司马"):
                        is_name = True

                if is_name:
                    candidates[name] += 1

    threshold = max(2, int(len(text) / 1000))
    threshold = min(threshold, 3)
    return [(name, count) for name, count in candidates.most_common() if count >= threshold and count >= 2]
