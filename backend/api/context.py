from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.db.database import get_session
from backend.db.models import Character, GlossaryTerm, PlotArc, Chapter, Novel
from backend.pipeline.context_gatherer import ContextGatherer

router = APIRouter()


@router.get("/context/{chapter_id}")
async def get_context(chapter_id: str, novel_id: str, session: AsyncSession = Depends(get_session)):
    novel = await session.get(Novel, novel_id)
    chapter = await session.get(Chapter, chapter_id)
    if not novel or not chapter:
        raise HTTPException(status_code=404, detail="Chapter or novel not found")

    result = await session.execute(
        select(Character).where(Character.novel_id == novel_id)
    )
    characters = result.scalars().all()

    result = await session.execute(
        select(GlossaryTerm).where(GlossaryTerm.novel_id == novel_id)
    )
    glossary = result.scalars().all()

    result = await session.execute(
        select(PlotArc).where(
            PlotArc.novel_id == novel_id,
            PlotArc.chapter_start <= chapter.number
        ).order_by(PlotArc.chapter_start.desc())
    )
    arcs = result.scalars().all()

    gatherer = ContextGatherer()
    context = gatherer.gather(
        novel=novel,
        chapter=chapter,
        characters=list(characters),
        glossary_terms=list(glossary),
        plot_arcs=list(arcs)
    )
    return context
