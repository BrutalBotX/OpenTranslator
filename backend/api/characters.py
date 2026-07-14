from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from backend.db.database import get_session
from backend.db.models import Character, Novel
from backend.utils.transliteration import transliterate, suggest_gender, infer_gender

router = APIRouter()


class CharacterCreate(BaseModel):
    novel_id: str
    name: str
    name_variants: list[str] = []
    gender: str = "Unknown"
    role: str = "Minor"
    status: str = "Alive"
    traits: Optional[dict] = None
    relationships: Optional[list] = None


class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    name_variants: Optional[list[str]] = None
    gender: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    state_summary: Optional[str] = None
    traits: Optional[dict] = None
    relationships: Optional[list] = None


class CharacterResponse(BaseModel):
    id: str
    novel_id: str
    name: str
    name_variants: list[str] = []
    gender: str = "Unknown"
    role: str = "Minor"
    status: str = "Alive"
    state_summary: str = ""
    transliteration: str = ""
    gender_reason: str = ""


@router.get("/characters", response_model=list[CharacterResponse])
async def list_characters(novel_id: str, session: AsyncSession = Depends(get_session)):
    novel = await session.get(Novel, novel_id)
    source_lang = novel.source_lang if novel else "zh"
    result = await session.execute(
        select(Character).where(Character.novel_id == novel_id)
    )
    chars = result.scalars().all()
    return [
        CharacterResponse(
            id=c.id, novel_id=c.novel_id, name=c.name,
            name_variants=c.name_variants or [], gender=c.gender,
            role=c.role, status=c.status, state_summary=c.state_summary or "",
            transliteration=transliterate(c.name, source_lang),
        )
        for c in chars
    ]


@router.post("/characters", response_model=CharacterResponse)
async def create_character(data: CharacterCreate, session: AsyncSession = Depends(get_session)):
    payload = data.model_dump(exclude_unset=True)
    payload.setdefault("name_variants", [])
    payload.setdefault("gender", "Unknown")
    payload.setdefault("role", "Minor")
    payload.setdefault("status", "Alive")
    from typing import Optional as _Optional
    gender_reason: _Optional[str] = None
    if payload.get("gender") == "Unknown":
        inferred = infer_gender(payload["name"])
        if inferred:
            payload["gender"] = inferred["gender"]
            gender_reason = inferred["reason"]
    character = Character(**payload)
    session.add(character)
    await session.commit()
    await session.refresh(character)
    novel = await session.get(Novel, character.novel_id)
    source_lang = novel.source_lang if novel else "zh"
    return CharacterResponse(
        id=character.id, novel_id=character.novel_id, name=character.name,
        name_variants=character.name_variants or [], gender=character.gender,
        role=character.role, status=character.status, state_summary=character.state_summary or "",
        transliteration=transliterate(character.name, source_lang),
        gender_reason=gender_reason or "",
    )


@router.put("/characters/{character_id}", response_model=CharacterResponse)
async def update_character(character_id: str, data: CharacterUpdate, session: AsyncSession = Depends(get_session)):
    character = await session.get(Character, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(character, key, value)
    await session.commit()
    await session.refresh(character)
    novel = await session.get(Novel, character.novel_id)
    source_lang = novel.source_lang if novel else "zh"
    return CharacterResponse(
        id=character.id, novel_id=character.novel_id, name=character.name,
        name_variants=character.name_variants or [], gender=character.gender,
        role=character.role, status=character.status, state_summary=character.state_summary or "",
        transliteration=transliterate(character.name, source_lang),
    )


@router.delete("/characters/{character_id}")
async def delete_character(character_id: str, session: AsyncSession = Depends(get_session)):
    character = await session.get(Character, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    await session.delete(character)
    await session.commit()
    return {"deleted": True}
