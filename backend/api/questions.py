import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from backend.db.database import get_session
from backend.db.models import QAItem, Segment, Chapter, Character, GlossaryTerm, Novel
from backend.pipeline.pipeline import TranslationPipeline
from backend.utils.transliteration import transliterate

router = APIRouter()
pipeline = TranslationPipeline()


class QuestionResponse(BaseModel):
    id: str
    segment_id: str
    question_type: str
    question: str
    context_snippet: str
    suggestions: list
    answer: str | None
    resolved: bool
    segment_source_text: str = ""
    segment_translation: str = ""
    segment_transliteration: str = ""


class AnswerRequest(BaseModel):
    answer: str


class BatchAnswerRequest(BaseModel):
    question_ids: list[str] | None = None
    question_type: str | None = None
    answer: str
    novel_id: str | None = None


class BatchDismissRequest(BaseModel):
    question_ids: list[str] | None = None
    question_type: str | None = None
    novel_id: str | None = None


@router.get("/questions", response_model=list[QuestionResponse])
async def list_questions(
    segment_id: Optional[str] = None,
    resolved: Optional[bool] = None,
    novel_id: Optional[str] = None,
    session: AsyncSession = Depends(get_session)
):
    query = select(QAItem, Segment.source_text, Segment.translation)
    query = query.join(Segment, QAItem.segment_id == Segment.id)
    if novel_id:
        query = query.join(Chapter, Segment.chapter_id == Chapter.id).where(Chapter.novel_id == novel_id)
    if segment_id:
        query = query.where(QAItem.segment_id == segment_id)
    if resolved is not None:
        query = query.where(QAItem.resolved == resolved)
    query = query.order_by(QAItem.resolved.asc(), QAItem.id.desc())
    result = await session.execute(query)
    rows = result.all()

    source_lang = ""
    if novel_id:
        novel = await session.get(Novel, novel_id)
        if novel:
            source_lang = novel.source_lang

    return [
        QuestionResponse(
            id=row[0].id,
            segment_id=row[0].segment_id,
            question_type=row[0].question_type,
            question=row[0].question,
            context_snippet=row[0].context_snippet or "",
            suggestions=row[0].suggestions or [],
            answer=row[0].answer,
            resolved=row[0].resolved,
            segment_source_text=row[1] or "",
            segment_translation=row[2] or "",
            segment_transliteration=transliterate(row[1] or "", source_lang),
        )
        for row in rows
    ]


async def _apply_answer_to_db(item: QAItem, answer: str, session: AsyncSession):
    """Auto-update characters or glossary based on QA answer."""
    if item.question_type == "Name":
        name_match = re.search(r'"([^"]+)"', item.question)
        if not name_match:
            return
        detected_name = name_match.group(1)

        answer_lower = answer.lower()

        alias_match = re.search(r'alias\s+(?:of\s+)?["\']?([^"\']+)["\']?', answer_lower)
        if alias_match:
            parent_name = alias_match.group(1).strip()
            seg = await session.get(Segment, item.segment_id)
            if seg:
                ch = await session.get(Chapter, seg.chapter_id)
                if ch:
                    existing = await session.execute(
                        select(Character).where(
                            Character.novel_id == ch.novel_id,
                            Character.name.ilike(parent_name)
                        )
                    )
                    parent_char = existing.scalar_one_or_none()
                    if parent_char:
                        variants = list(parent_char.name_variants or [])
                        if detected_name not in variants:
                            variants.append(detected_name)
                            parent_char.name_variants = variants
                    else:
                        char = Character(
                            novel_id=ch.novel_id,
                            name=parent_name.title(),
                            name_variants=[detected_name],
                            gender="Unknown",
                            role="Supporting",
                            status="Alive",
                        )
                        session.add(char)
            return

        glossary_match = re.search(r'(?:glossary|term|location|place|city|item|technique|weapon|artifact)', answer_lower)
        if glossary_match and not alias_match:
            seg = await session.get(Segment, item.segment_id)
            if seg:
                ch = await session.get(Chapter, seg.chapter_id)
                if ch:
                    cat = "Place" if any(w in answer_lower for w in ["location", "place", "city", "continent"]) else "Item"
                    existing = await session.execute(
                        select(GlossaryTerm).where(
                            GlossaryTerm.novel_id == ch.novel_id,
                            GlossaryTerm.source_term == detected_name
                        )
                    )
                    if not existing.scalar_one_or_none():
                        term = GlossaryTerm(
                            novel_id=ch.novel_id,
                            source_term=detected_name,
                            target_term=detected_name,
                            category=cat,
                        )
                        session.add(term)
            return

        is_char = "character" in answer_lower or "male" in answer_lower or "female" in answer_lower
        is_place = any(w in answer_lower for w in ["location", "place", "city", "continent"])
        is_item = any(w in answer_lower for w in ["item", "technique", "weapon", "artifact"])
        gender = "Male" if "male" in answer_lower else "Female" if "female" in answer_lower else None

        seg = await session.get(Segment, item.segment_id)
        if not seg:
            return
        ch = await session.get(Chapter, seg.chapter_id)
        if not ch:
            return
        novel_id = ch.novel_id

        if is_char or (gender and not is_place and not is_item):
            existing = await session.execute(
                select(Character).where(Character.novel_id == novel_id, Character.name.ilike(detected_name))
            )
            existing_char = existing.scalar_one_or_none()
            if existing_char:
                if gender:
                    existing_char.gender = gender
                existing_char.role = existing_char.role if existing_char.role != "Minor" else "Supporting"
            else:
                char = Character(
                    novel_id=novel_id,
                    name=detected_name,
                    name_variants=[detected_name],
                    gender=gender or "Unknown",
                    role="Supporting",
                    status="Alive",
                )
                session.add(char)
        elif is_place or is_item:
            cat = "Place" if is_place else "Item"
            existing = await session.execute(
                select(GlossaryTerm).where(GlossaryTerm.novel_id == novel_id, GlossaryTerm.source_term.ilike(detected_name))
            )
            if not existing.scalar_one_or_none():
                term = GlossaryTerm(
                    novel_id=novel_id,
                    source_term=detected_name,
                    target_term=detected_name,
                    category=cat,
                )
                session.add(term)

    elif item.question_type == "Gender":
        seg = await session.get(Segment, item.segment_id)
        if seg:
            ch = await session.get(Chapter, seg.chapter_id)
            if ch:
                name_match = re.search(r'"([^"]+)"', item.question)
                if name_match:
                    name = name_match.group(1)
                    answer_lower = answer.lower()
                    gender = "Male" if "male" in answer_lower else "Female" if "female" in answer_lower else None
                    if gender:
                        existing = await session.execute(
                            select(Character).where(Character.novel_id == ch.novel_id, Character.name.ilike(name))
                        )
                        char = existing.scalar_one_or_none()
                        if char:
                            char.gender = gender

    await session.commit()


@router.post("/questions/{question_id}/answer", response_model=QuestionResponse)
async def answer_question(question_id: str, data: AnswerRequest, session: AsyncSession = Depends(get_session)):
    item = await session.get(QAItem, question_id)
    if not item:
        raise HTTPException(status_code=404, detail="Question not found")
    item.answer = data.answer
    item.resolved = True
    await _apply_answer_to_db(item, data.answer, session)
    await session.commit()
    await session.refresh(item)
    return item


@router.post("/questions/{question_id}/answer-and-retranslate")
async def answer_and_retranslate(question_id: str, data: AnswerRequest, session: AsyncSession = Depends(get_session)):
    item = await session.get(QAItem, question_id)
    if not item:
        raise HTTPException(status_code=404, detail="Question not found")

    item.answer = data.answer
    item.resolved = True
    await _apply_answer_to_db(item, data.answer, session)

    seg = await session.get(Segment, item.segment_id)
    if not seg:
        raise HTTPException(status_code=404, detail="Segment not found")

    segment = await session.get(Segment, item.segment_id)
    chapter = await session.get(Chapter, segment.chapter_id) if segment else None
    if not segment or not chapter:
        return {"answer": data.answer, "retranslation": "", "error": "Segment or chapter not found"}

    try:
        result = await pipeline.translate(
            source_text=segment.source_text,
            chapter_id=segment.chapter_id,
            novel_id=chapter.novel_id,
        )
        translation = result.get("translation", "")
        if translation:
            segment.translation = translation
            segment.status = "translated" if not result.get("warnings") else "needs_review"
            await session.commit()
        return {
            "answer": data.answer,
            "retranslation": translation,
            "warnings": result.get("warnings", []),
        }
    except Exception as e:
        return {"answer": data.answer, "retranslation": "", "error": str(e)}


@router.post("/questions/{question_id}/dismiss")
async def dismiss_question(question_id: str, session: AsyncSession = Depends(get_session)):
    item = await session.get(QAItem, question_id)
    if not item:
        raise HTTPException(status_code=404, detail="Question not found")
    await session.delete(item)
    await session.commit()
    return {"dismissed": True}


@router.post("/questions/batch-answer")
async def batch_answer_questions(data: BatchAnswerRequest, session: AsyncSession = Depends(get_session)):
    query = select(QAItem).where(QAItem.resolved == False)
    if data.question_ids:
        query = query.where(QAItem.id.in_(data.question_ids))
    elif data.question_type:
        query = query.where(QAItem.question_type == data.question_type)
        if data.novel_id:
            query = query.join(Segment, QAItem.segment_id == Segment.id) \
                         .join(Chapter, Segment.chapter_id == Chapter.id) \
                         .where(Chapter.novel_id == data.novel_id)
    else:
        return {"answered": 0}

    result = await session.execute(query)
    items = result.scalars().all()

    for item in items:
        item.answer = data.answer
        item.resolved = True
        if item.question_type in ("Name", "Cultural"):
            await _apply_answer_to_db(item, data.answer, session)

    await session.commit()
    return {"answered": len(items)}


@router.post("/questions/batch-dismiss")
async def batch_dismiss_questions(data: BatchDismissRequest, session: AsyncSession = Depends(get_session)):
    query = select(QAItem)
    if data.question_ids:
        query = query.where(QAItem.id.in_(data.question_ids))
    elif data.question_type:
        query = query.where(QAItem.question_type == data.question_type)
        if data.novel_id:
            query = query.join(Segment, QAItem.segment_id == Segment.id) \
                         .join(Chapter, Segment.chapter_id == Chapter.id) \
                         .where(Chapter.novel_id == data.novel_id)
    else:
        return {"dismissed": 0}

    result = await session.execute(query)
    items = result.scalars().all()

    for item in items:
        await session.delete(item)

    await session.commit()
    return {"dismissed": len(items)}


@router.post("/questions/batch-answer-and-classify")
async def batch_answer_and_classify(data: BatchAnswerRequest, session: AsyncSession = Depends(get_session)):
    query = select(QAItem).where(
        QAItem.resolved == False,
        QAItem.question_type == "Name",
    )
    if data.novel_id:
        query = query.join(Segment, QAItem.segment_id == Segment.id) \
                     .join(Chapter, Segment.chapter_id == Chapter.id) \
                     .where(Chapter.novel_id == data.novel_id)

    result = await session.execute(query)
    items = result.scalars().all()

    if data.question_ids:
        items = [i for i in items if i.id in data.question_ids]

    answer_lower = data.answer.lower()
    for item in items:
        item.answer = data.answer
        item.resolved = True
        await _apply_answer_to_db(item, data.answer, session)

    await session.commit()
    return {"answered": len(items)}
