from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from backend.db.database import get_session
from backend.db.models import GlossaryTerm

router = APIRouter()


class GlossaryCreate(BaseModel):
    novel_id: str
    source_term: str
    target_term: str
    category: str = "Term"
    context_note: str = ""
    is_name: bool = False
    gender_hint: str = ""


class GlossaryUpdate(BaseModel):
    source_term: Optional[str] = None
    target_term: Optional[str] = None
    category: Optional[str] = None
    context_note: Optional[str] = None
    is_name: Optional[bool] = None
    gender_hint: Optional[str] = None


class GlossaryResponse(BaseModel):
    id: str
    novel_id: str
    source_term: str
    target_term: str
    category: str
    context_note: str = ""
    is_name: bool = False
    gender_hint: str = ""


@router.get("/glossary", response_model=list[GlossaryResponse])
async def list_glossary(novel_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(GlossaryTerm).where(GlossaryTerm.novel_id == novel_id)
    )
    return result.scalars().all()


@router.post("/glossary", response_model=GlossaryResponse)
async def create_glossary_term(data: GlossaryCreate, session: AsyncSession = Depends(get_session)):
    term = GlossaryTerm(**data.model_dump())
    session.add(term)
    await session.commit()
    await session.refresh(term)
    return term


@router.put("/glossary/{term_id}", response_model=GlossaryResponse)
async def update_glossary_term(term_id: str, data: GlossaryUpdate, session: AsyncSession = Depends(get_session)):
    term = await session.get(GlossaryTerm, term_id)
    if not term:
        raise HTTPException(status_code=404, detail="Glossary term not found")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(term, key, value)
    await session.commit()
    await session.refresh(term)
    return term


@router.delete("/glossary/{term_id}")
async def delete_glossary_term(term_id: str, session: AsyncSession = Depends(get_session)):
    term = await session.get(GlossaryTerm, term_id)
    if not term:
        raise HTTPException(status_code=404, detail="Glossary term not found")
    await session.delete(term)
    await session.commit()
    return {"deleted": True}
