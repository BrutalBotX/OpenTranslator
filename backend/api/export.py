from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from backend.db.database import get_session
from backend.db.models import Novel, Chapter, Segment
from backend.export.html import HTMLExporter
from backend.export.plaintext import PlainTextExporter
from backend.export.epub import EPUBExporter

router = APIRouter()


class ExportRequest(BaseModel):
    novel_id: str
    format: str
    include_source: bool = False
    show_numbers: bool = False


@router.post("/export")
async def export_novel(req: ExportRequest, session: AsyncSession = Depends(get_session)):
    novel = await session.get(Novel, req.novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="Novel not found")

    result = await session.execute(
        select(Chapter).where(Chapter.novel_id == req.novel_id).order_by(Chapter.number)
    )
    chapters = result.scalars().all()
    chapter_ids = [ch.id for ch in chapters]
    if not chapter_ids:
        return {"content": "", "filename": f"{novel.title}.txt"}

    seg_result = await session.execute(
        select(Segment).where(Segment.chapter_id.in_(chapter_ids)).order_by(Segment.segment_number)
    )
    all_segs = seg_result.scalars().all()

    segs_by_chapter_id: dict[str, list[dict]] = {}
    for s in all_segs:
        segs_by_chapter_id.setdefault(s.chapter_id, []).append({
            "id": s.id, "source_text": s.source_text, "translation": s.translation or "", "status": s.status,
        })

    chapters_data = []
    segments_by_chapter = []
    for ch in chapters:
        chapters_data.append({"id": ch.id, "title": ch.title, "number": ch.number})
        segments_by_chapter.append(segs_by_chapter_id.get(ch.id, []))

    if req.format == "plaintext":
        exporter = PlainTextExporter()
        content = exporter.export(novel.title, chapters_data, segments_by_chapter)
        return {"content": content, "format": "text"}

    elif req.format == "html":
        exporter = HTMLExporter()
        content = exporter.export(novel.title, chapters_data, segments_by_chapter,
                                  include_source=req.include_source, show_numbers=req.show_numbers)
        return {"content": content, "format": "html"}

    elif req.format == "epub":
        exporter = EPUBExporter()
        raw = exporter.export(novel.title, chapters_data, segments_by_chapter, novel_id=novel.id)
        import base64
        return {"content": base64.b64encode(raw).decode(), "format": "epub", "filename": f"{novel.title}.epub"}

    raise HTTPException(status_code=400, detail=f"Unsupported format: {req.format}")
