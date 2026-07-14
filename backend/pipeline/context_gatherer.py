import asyncio
from sqlalchemy import select

from backend.db.database import async_session
from backend.db.models import Character, GlossaryTerm, PlotArc, Chapter, Novel
from backend.db.vector_store import search_similar


class ContextGatherer:
    def gather(
        self,
        novel: Novel,
        chapter: Chapter,
        characters: list[Character],
        glossary_terms: list[GlossaryTerm],
        plot_arcs: list[PlotArc],
        translation_memory: list[dict] = None,
    ) -> dict:
        return {
            "source_lang": novel.source_lang,
            "target_lang": novel.target_lang,
            "genre": novel.genre or "",
            "novel_summary": novel.summary or "",
            "instructions": novel.instructions or "",
            "chapter_title": chapter.title,
            "chapter_number": chapter.number,
            "characters": [
                {
                    "name": c.name,
                    "name_variants": c.name_variants or [],
                    "gender": c.gender,
                    "role": c.role,
                    "status": c.status,
                    "state_summary": c.state_summary
                }
                for c in characters
            ],
            "glossary": [
                {
                    "id": str(g.id),
                    "source_term": g.source_term,
                    "target_term": g.target_term,
                    "category": g.category,
                    "context_note": g.context_note,
                    "is_name": g.is_name
                }
                for g in glossary_terms
            ],
            "plot_arcs": [
                {
                    "arc_name": a.arc_name,
                    "summary": a.summary,
                    "active_issues": a.active_issues
                }
                for a in plot_arcs
            ],
            "translation_memory": translation_memory or [],
        }

    async def gather_async(self, chapter_id: str, novel_id: str, source_text: str = "") -> dict:
        async with async_session() as session:
            novel = await session.get(Novel, novel_id)
            chapter = await session.get(Chapter, chapter_id)
            if not novel or not chapter:
                return {}

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

        tm = []
        if source_text:
            tm = await asyncio.to_thread(search_similar, source_text, novel_id)

        return self.gather(novel, chapter, list(characters), list(glossary), list(arcs), translation_memory=tm)
