from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from backend.db.database import get_session
from backend.db.models import Character

router = APIRouter()


class CharacterCreate(BaseModel):
    novel_id: str
    name: str
    name_variants: list[str] = []
    gender: str = "Unknown"
    role: str = "Minor"
    status: str = "Alive"
    traits: dict = {}
    relationships: list = []


class CharacterResponse(BaseModel):
    id: str
    novel_id: str
    name: str
    name_variants: list
    gender: str
    role: str
    status: str
    state_summary: str


@router.get("/characters", response_model=list[CharacterResponse])
async def list_characters(novel_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(Character).where(Character.novel_id == novel_id)
    )
    return result.scalars().all()


@router.post("/characters", response_model=CharacterResponse)
async def create_character(data: CharacterCreate, session: AsyncSession = Depends(get_session)):
    character = Character(**data.model_dump())
    session.add(character)
    await session.commit()
    await session.refresh(character)
    return character


@router.put("/characters/{character_id}", response_model=CharacterResponse)
async def update_character(character_id: str, data: dict, session: AsyncSession = Depends(get_session)):
    character = await session.get(Character, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    for key, value in data.items():
        setattr(character, key, value)
    await session.commit()
    await session.refresh(character)
    return character


@router.delete("/characters/{character_id}")
async def delete_character(character_id: str, session: AsyncSession = Depends(get_session)):
    character = await session.get(Character, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    await session.delete(character)
    await session.commit()
    return {"deleted": True}
