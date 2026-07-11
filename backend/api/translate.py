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
                    add_to_tm(
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
        detail = str(e)
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
        return result
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


class SaveTranslationRequest(BaseModel):
    translation: str
    status: str = "translated"
    novel_id: str = ""


@router.put("/segments/{segment_id}")
async def save_segment(segment_id: str, data: SaveTranslationRequest, session: AsyncSession = Depends(get_session)):
    segment = await session.get(Segment, segment_id)
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    segment.translation = data.translation
    segment.status = data.status
    await session.commit()

    if data.translation and data.novel_id:
        add_to_tm(
            segment_id=segment_id,
            source_text=segment.source_text,
            target_text=data.translation,
            novel_id=data.novel_id,
            chapter_id=segment.chapter_id,
        )

    return {"saved": True}
