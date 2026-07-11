import re

WORD = r'[\w\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]+'

REPLACE_NAME_PATTERN = re.compile(
    fr'(?:replace|rename|change)\s+'
    fr'(?:the\s+)?(?:name\s+)?["\']?({WORD}(?:\s+{WORD})?)["\']?\s+'
    fr'(?:to|with|into)\s+'
    fr'["\']?({WORD}(?:\s+{WORD})?)["\']?',
    re.IGNORECASE,
)

ALIAS_PATTERN = re.compile(
    fr'(?:add|set|mark)\s+["\']?({WORD}(?:\s+(?!as\b){WORD})?)["\']?\s+'
    fr'(?:as\s+)?(?:an?\s+)?alias\s+(?:of|for)\s+["\']?({WORD}(?:\s+{WORD})?)["\']?',
    re.IGNORECASE,
)

ALIAS_PATTERN2 = re.compile(
    fr'(?:add|set|mark)\s+(?:an?\s+)?alias\s+["\']?({WORD}(?:\s+{WORD})?)["\']?\s+'
    fr'(?:of|for)\s+["\']?({WORD}(?:\s+{WORD})?)["\']?',
    re.IGNORECASE,
)


def parse_instruction(instruction: str) -> list[dict]:
    results = []

    for match in REPLACE_NAME_PATTERN.finditer(instruction):
        source = match.group(1).strip()
        target = match.group(2).strip()
        if source and target:
            results.append({
                "action": "replace_name",
                "source": source,
                "target": target,
            })

    for match in ALIAS_PATTERN.finditer(instruction):
        alias = match.group(1).strip()
        character = match.group(2).strip()
        if alias and character and alias.lower() != "as":
            results.append({
                "action": "add_alias",
                "alias": alias,
                "character": character,
            })

    for match in ALIAS_PATTERN2.finditer(instruction):
        alias = match.group(1).strip()
        character = match.group(2).strip()
        if alias and character:
            if not any(
                r["action"] == "add_alias" and r["alias"] == alias and r["character"] == character
                for r in results
            ):
                results.append({
                    "action": "add_alias",
                    "alias": alias,
                    "character": character,
                })

    return results


def apply_instruction_actions(actions: list[dict], novel_id: str):
    from sqlalchemy import select
    from backend.db.database import async_session
    from backend.db.models import Character, GlossaryTerm
    import asyncio

    async def _apply():
        async with async_session() as session:
            for action in actions:
                if action["action"] == "replace_name":
                    existing = await session.execute(
                        select(Character).where(
                            Character.novel_id == novel_id,
                            Character.name.ilike(action["source"]),
                        )
                    )
                    char = existing.scalar_one_or_none()
                    if char:
                        variants = list(char.name_variants or [])
                        if action["target"] not in variants:
                            variants.append(action["target"])
                            char.name_variants = variants
                    else:
                        existing_term = await session.execute(
                            select(GlossaryTerm).where(
                                GlossaryTerm.novel_id == novel_id,
                                GlossaryTerm.source_term.ilike(action["source"]),
                            )
                        )
                        term = existing_term.scalar_one_or_none()
                        if not term:
                            session.add(GlossaryTerm(
                                novel_id=novel_id,
                                source_term=action["source"],
                                target_term=action["target"],
                                category="Name",
                            ))

                elif action["action"] == "add_alias":
                    existing = await session.execute(
                        select(Character).where(
                            Character.novel_id == novel_id,
                            Character.name.ilike(action["character"]),
                        )
                    )
                    char = existing.scalar_one_or_none()
                    if char:
                        variants = list(char.name_variants or [])
                        if action["alias"] not in variants:
                            variants.append(action["alias"])
                            char.name_variants = variants
                    else:
                        new_char = Character(
                            novel_id=novel_id,
                            name=action["character"].title(),
                            name_variants=[action["alias"]],
                            gender="Unknown",
                            role="Supporting",
                            status="Alive",
                        )
                        session.add(new_char)

            await session.commit()

    asyncio.run(_apply())
