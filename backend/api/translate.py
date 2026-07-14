import asyncio
import re
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import traceback

from backend.pipeline.pipeline import TranslationPipeline
from backend.pipeline.chapter_translator import ChapterTranslator, get_translate_progress, cancel_translation
from backend.db.database import get_session
from backend.db.models import Chapter, Segment
from backend.db.vector_store import add_to_tm

router = APIRouter()

_SENSITIVE_PATTERNS = [
    re.compile(r'(sk-[a-zA-Z0-9]{10,})'),
    re.compile(r'(AIza[a-zA-Z0-9_-]{10,})'),
    re.compile(r'(api[_-]?key["\']?\s*[:=]\s*["\']?)([^"\'&\s]{4})([^"\'&\s]+)', re.IGNORECASE),
]


def sanitize_error(msg: str) -> str:
    for pattern in _SENSITIVE_PATTERNS:
        msg = pattern.sub(r'\1***REDACTED***', msg)
    if len(msg) > 300:
        msg = msg[:300] + '...'
    return msg


pipeline = TranslationPipeline()


class TranslateRequest(BaseModel):
    source_text: str
    chapter_id: str
    novel_id: str
    segment_id: str = ""


class TranslateResponse(BaseModel):
    translation: str
    warnings: list[str]
    questions_pending: bool = False


@router.post("/translate", response_model=TranslateResponse)
async def translate_segment(req: TranslateRequest, session: AsyncSession = Depends(get_session)):
    try:
        result = await pipeline.translate(
            source_text=req.source_text,
            chapter_id=req.chapter_id,
            novel_id=req.novel_id
        )

        translation_text = result.get("translation", "")
        if req.segment_id and not result.get("questions_pending"):
            segment = await session.get(Segment, req.segment_id)
            if segment:
                segment.translation = translation_text
                segment.status = "translated" if not result.get("warnings") else "needs_review"
                await session.commit()

                if translation_text:
                    await asyncio.to_thread(
                        add_to_tm,
                        segment_id=req.segment_id,
                        source_text=req.source_text,
                        target_text=translation_text,
                        novel_id=req.novel_id,
                        chapter_id=req.chapter_id,
                    )

        return TranslateResponse(
            translation=result.get("translation", ""),
            warnings=result.get("warnings", []),
            questions_pending=result.get("questions_pending", False),
        )
    except Exception as e:
        detail = sanitize_error(str(e))
        raise HTTPException(status_code=503, detail=detail)


chapter_translator = ChapterTranslator()


class TranslateAllRequest(BaseModel):
    novel_id: str


@router.post("/chapters/{chapter_id}/translate-all")
async def translate_all_chapters(chapter_id: str, req: TranslateAllRequest):
    try:
        result = await chapter_translator.translate_chapter(
            chapter_id=chapter_id,
            novel_id=req.novel_id,
        )
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/chapters/{chapter_id}/translate-progress")
async def translate_progress(chapter_id: str):
    return get_translate_progress(chapter_id)


@router.post("/chapters/{chapter_id}/cancel-translation")
async def cancel_chapter_translation(chapter_id: str):
    cancel_translation(chapter_id)
    return {"cancelled": True}


@router.get("/tm/search")
async def search_tm(query: str, novel_id: str, n_results: int = 3):
    from backend.db.vector_store import search_similar
    results = await asyncio.to_thread(lambda: search_similar(query, novel_id, n_results=n_results))
    return {"results": results}


@router.post("/chapters/{chapter_id}/apply-qa")
async def apply_qa_chapter(chapter_id: str, req: TranslateAllRequest):
    try:
        result = await chapter_translator.apply_qa(
            chapter_id=chapter_id,
            novel_id=req.novel_id,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


VALID_SEGMENT_STATUSES = {"untouched", "translating", "translated", "needs_review"}

class SaveTranslationRequest(BaseModel):
    translation: str
    status: str = "translated"
    novel_id: str = ""


@router.put("/segments/{segment_id}")
async def save_segment(segment_id: str, data: SaveTranslationRequest, session: AsyncSession = Depends(get_session)):
    segment = await session.get(Segment, segment_id)
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    if data.status not in VALID_SEGMENT_STATUSES:
        raise HTTPException(status_code=422, detail=f"Invalid status: '{data.status}'")
    segment.translation = data.translation
    segment.status = data.status
    await session.commit()

    if data.translation and data.novel_id:
        await asyncio.to_thread(
            add_to_tm,
            segment_id=segment_id,
            source_text=segment.source_text,
            target_text=data.translation,
            novel_id=data.novel_id,
            chapter_id=segment.chapter_id,
        )

    return {"saved": True}


class BatchUpdateRequest(BaseModel):
    segment_ids: list[str]
    status: str = "translated"
    novel_id: str = ""


@router.put("/segments/batch", response_model=dict)
async def batch_update_segments(data: BatchUpdateRequest, session: AsyncSession = Depends(get_session)):
    if data.status not in VALID_SEGMENT_STATUSES:
        raise HTTPException(status_code=422, detail=f"Invalid status: '{data.status}'")
    result = await session.execute(
        select(Segment).where(Segment.id.in_(data.segment_ids))
    )
    segments = result.scalars().all()
    for seg in segments:
        seg.status = data.status
    await session.commit()
    return {"updated": len(segments)}
