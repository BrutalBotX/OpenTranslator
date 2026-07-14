import asyncio
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional, List

from backend.db.database import get_session
from backend.db.models import Novel, Chapter, Segment, Character, GlossaryTerm
from backend.utils import detect_potential_characters
from backend.utils.transliteration import transliterate
from backend.api.translate import TranslateAllRequest

router = APIRouter()


class ProjectCreate(BaseModel):
    title: str
    source_lang: str = "zh"
    target_lang: str = "en"
    genre: str = ""


class ProjectResponse(BaseModel):
    id: str
    title: str
    source_lang: str
    target_lang: str
    genre: str
    summary: str
    chapter_count: int = 0
    created_at: str
    updated_at: str


class ChapterResponse(BaseModel):
    id: str
    novel_id: str
    number: int
    title: str
    translated: bool
    word_count: int
    segment_count: int = 0


class SegmentResponse(BaseModel):
    id: str
    chapter_id: str
    segment_number: int
    source_text: str
    translation: str
    status: str
    has_qa: bool
    transliteration: str = ""


@router.get("/projects", response_model=List[ProjectResponse])
async def list_projects(session: AsyncSession = Depends(get_session)):
    ch_count_subq = select(Chapter.novel_id, func.count(Chapter.id).label("cnt")).group_by(Chapter.novel_id).subquery()
    result = await session.execute(
        select(Novel, func.coalesce(ch_count_subq.c.cnt, 0))
        .outerjoin(ch_count_subq, Novel.id == ch_count_subq.c.novel_id)
        .order_by(Novel.updated_at.desc())
    )
    rows = result.all()
    output = []
    for novel, ch_count in rows:
        output.append(ProjectResponse(
            id=novel.id,
            title=novel.title,
            source_lang=novel.source_lang,
            target_lang=novel.target_lang,
            genre=novel.genre,
            summary=novel.summary or "",
            chapter_count=ch_count or 0,
            created_at=novel.created_at.isoformat() if novel.created_at else "",
            updated_at=novel.updated_at.isoformat() if novel.updated_at else "",
        ))
    return output


@router.post("/projects", response_model=ProjectResponse, status_code=201)
async def create_project(data: ProjectCreate, session: AsyncSession = Depends(get_session)):
    novel = Novel(
        title=data.title,
        source_lang=data.source_lang,
        target_lang=data.target_lang,
        genre=data.genre,
    )
    session.add(novel)
    await session.commit()
    await session.refresh(novel)
    return ProjectResponse(
        id=novel.id,
        title=novel.title,
        source_lang=novel.source_lang,
        target_lang=novel.target_lang,
        genre=novel.genre or "",
        summary=novel.summary or "",
        chapter_count=0,
        created_at=novel.created_at.isoformat() if novel.created_at else "",
        updated_at=novel.updated_at.isoformat() if novel.updated_at else "",
    )


@router.get("/projects/{novel_id}", response_model=ProjectResponse)
async def get_project(novel_id: str, session: AsyncSession = Depends(get_session)):
    novel = await session.get(Novel, novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="Project not found")
    ch_count = await session.scalar(
        select(func.count(Chapter.id)).where(Chapter.novel_id == novel.id)
    )
    return ProjectResponse(
        id=novel.id,
        title=novel.title,
        source_lang=novel.source_lang,
        target_lang=novel.target_lang,
        genre=novel.genre or "",
        summary=novel.summary or "",
        chapter_count=ch_count or 0,
        created_at=novel.created_at.isoformat() if novel.created_at else "",
        updated_at=novel.updated_at.isoformat() if novel.updated_at else "",
    )


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    genre: Optional[str] = None
    source_lang: Optional[str] = None
    target_lang: Optional[str] = None


@router.put("/projects/{novel_id}", response_model=ProjectResponse)
async def update_project(novel_id: str, data: ProjectUpdate, session: AsyncSession = Depends(get_session)):
    novel = await session.get(Novel, novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="Project not found")
    if data.title is not None:
        novel.title = data.title
    if data.genre is not None:
        novel.genre = data.genre
    if data.source_lang is not None:
        novel.source_lang = data.source_lang
    if data.target_lang is not None:
        novel.target_lang = data.target_lang
    await session.commit()
    await session.refresh(novel)
    ch_count = await session.scalar(
        select(func.count(Chapter.id)).where(Chapter.novel_id == novel.id)
    )
    return ProjectResponse(
        id=novel.id,
        title=novel.title,
        source_lang=novel.source_lang,
        target_lang=novel.target_lang,
        genre=novel.genre or "",
        summary=novel.summary or "",
        chapter_count=ch_count or 0,
        created_at=novel.created_at.isoformat() if novel.created_at else "",
        updated_at=novel.updated_at.isoformat() if novel.updated_at else "",
    )


@router.delete("/projects/{novel_id}")
async def delete_project(novel_id: str, session: AsyncSession = Depends(get_session)):
    novel = await session.get(Novel, novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="Project not found")
    await session.delete(novel)
    await session.commit()
    return {"deleted": True}


class InstructionsRequest(BaseModel):
    instructions: str


@router.get("/projects/{novel_id}/instructions")
async def get_instructions(novel_id: str, session: AsyncSession = Depends(get_session)):
    novel = await session.get(Novel, novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"instructions": novel.instructions or ""}


@router.put("/projects/{novel_id}/instructions")
async def save_instructions(novel_id: str, data: InstructionsRequest, session: AsyncSession = Depends(get_session)):
    novel = await session.get(Novel, novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="Project not found")

    from backend.utils.instructions import parse_instruction, apply_instruction_actions

    # Save instructions text first, then apply actions in the same transaction
    novel.instructions = data.instructions
    await session.flush()

    actions = parse_instruction(data.instructions)
    if actions:
        await apply_instruction_actions(actions, novel_id, session=session)

    await session.commit()

    return {"saved": True, "actions_applied": len(actions)}


class PresetRequest(BaseModel):
    name: str
    instructions: str


@router.get("/projects/presets")
async def list_presets(session: AsyncSession = Depends(get_session)):
    from backend.db.models import Setting as SettingModel
    result = await session.execute(
        select(SettingModel).where(SettingModel.key.like("preset:%"))
    )
    presets = []
    for row in result.scalars().all():
        presets.append({"name": row.key.replace("preset:", ""), "instructions": row.value})
    return {"presets": presets}


@router.post("/projects/presets")
async def save_preset(data: PresetRequest, session: AsyncSession = Depends(get_session)):
    from backend.db.models import Setting as SettingModel
    row = await session.get(SettingModel, f"preset:{data.name}")
    if row:
        row.value = data.instructions
    else:
        session.add(SettingModel(key=f"preset:{data.name}", value=data.instructions))
    await session.commit()
    return {"saved": True}


@router.delete("/projects/presets/{name}")
async def delete_preset(name: str, session: AsyncSession = Depends(get_session)):
    from backend.db.models import Setting as SettingModel
    row = await session.get(SettingModel, f"preset:{name}")
    if row:
        await session.delete(row)
        await session.commit()
    return {"deleted": True}


@router.get("/projects/{novel_id}/export-proj")
async def export_project(novel_id: str, session: AsyncSession = Depends(get_session)):
    novel = await session.get(Novel, novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="Project not found")

    result = await session.execute(
        select(Chapter).where(Chapter.novel_id == novel_id).order_by(Chapter.number)
    )
    chapters = result.scalars().all()

    result = await session.execute(
        select(Character).where(Character.novel_id == novel_id)
    )
    characters = result.scalars().all()

    result = await session.execute(
        select(GlossaryTerm).where(GlossaryTerm.novel_id == novel_id)
    )
    glossary = result.scalars().all()

    chapters_data = []
    for ch in chapters:
        seg_result = await session.execute(
            select(Segment).where(Segment.chapter_id == ch.id).order_by(Segment.segment_number)
        )
        segs = seg_result.scalars().all()
        chapters_data.append({
            "id": ch.id, "number": ch.number, "title": ch.title,
            "source_text": ch.source_text, "translated": ch.translated,
            "segments": [
                {"id": s.id, "segment_number": s.segment_number,
                 "source_text": s.source_text, "translation": s.translation,
                 "status": s.status, "has_qa": s.has_qa}
                for s in segs
            ],
        })

    return {
        "novel": {
            "id": novel.id, "title": novel.title,
            "source_lang": novel.source_lang, "target_lang": novel.target_lang,
            "genre": novel.genre, "summary": novel.summary, "instructions": novel.instructions,
        },
        "characters": [
            {"id": c.id, "name": c.name, "name_variants": c.name_variants,
             "gender": c.gender, "role": c.role, "status": c.status,
             "state_summary": c.state_summary}
            for c in characters
        ],
        "glossary": [
            {"id": g.id, "source_term": g.source_term, "target_term": g.target_term,
             "category": g.category, "context_note": g.context_note, "is_name": g.is_name}
            for g in glossary
        ],
        "chapters": chapters_data,
    }


class ImportProjectRequest(BaseModel):
    data: dict


@router.post("/projects/import-proj")
async def import_project(req: ImportProjectRequest, session: AsyncSession = Depends(get_session)):
    data = req.data
    novel_data = data.get("novel", {})
    novel_id = novel_data.get("id")

    existing = await session.get(Novel, novel_id) if novel_id else None
    if existing:
        for k, v in novel_data.items():
            if k != "id" and hasattr(existing, k):
                setattr(existing, k, v)
        novel = existing
    else:
        novel = Novel(**{k: v for k, v in novel_data.items() if hasattr(Novel, k) and k != "id"})
        novel.id = novel_id
        session.add(novel)
    await session.flush()

    for ch_data in data.get("chapters", []):
        existing_ch = await session.get(Chapter, ch_data["id"]) if ch_data.get("id") else None
        if not existing_ch:
            existing_ch = await session.execute(
                select(Chapter).where(
                    Chapter.novel_id == novel.id,
                    Chapter.number == ch_data["number"]
                )
            ).scalar_one_or_none()

        ch = existing_ch or Chapter(novel_id=novel.id)
        for k in ("id", "number", "title", "source_text", "translated"):
            if k in ch_data:
                setattr(ch, k, ch_data[k])
        if not existing_ch:
            session.add(ch)
        await session.flush()

        for seg_data in ch_data.get("segments", []):
            existing_seg = await session.get(Segment, seg_data["id"]) if seg_data.get("id") else None
            seg = existing_seg or Segment(chapter_id=ch.id, id=seg_data.get("id"))
            for k in ("id", "segment_number", "source_text", "translation", "status", "has_qa"):
                if k in seg_data:
                    setattr(seg, k, seg_data[k])
            if not existing_seg:
                session.add(seg)

    for char_data in data.get("characters", []):
        existing_c = await session.get(Character, char_data["id"]) if char_data.get("id") else None
        c = existing_c or Character(novel_id=novel.id)
        for k, v in char_data.items():
            if k != "id" and hasattr(c, k):
                setattr(c, k, v)
        if not existing_c:
            session.add(c)

    for term_data in data.get("glossary", []):
        existing_g = await session.get(GlossaryTerm, term_data["id"]) if term_data.get("id") else None
        g = existing_g or GlossaryTerm(novel_id=novel.id)
        for k, v in term_data.items():
            if k != "id" and hasattr(g, k):
                setattr(g, k, v)
        if not existing_g:
            session.add(g)

    await session.commit()
    return {"id": novel.id, "title": novel.title}


class ChapterImport(BaseModel):
    novel_id: str
    title: str = ""
    content: str
    number: Optional[int] = None


@router.post("/chapters/import", response_model=ChapterResponse, status_code=201)
async def import_chapter(data: ChapterImport, session: AsyncSession = Depends(get_session)):
    novel = await session.get(Novel, data.novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="Project not found")

    if data.number is None:
        max_num = await session.scalar(
            select(func.max(Chapter.number)).where(Chapter.novel_id == data.novel_id)
        )
        chapter_number = (max_num or 0) + 1
    else:
        chapter_number = data.number

    if not data.title:
        first_line = data.content.split("\n")[0].strip() if data.content else ""
        import re as _re
        m = _re.match(r'^(?:Chapter|CHAPTER|Ch\.|第[\u4e00-\u9fff]*(?:章|話|화))\s*\d*[：:\s]*(.+)$', first_line)
        if m:
            data.title = m.group(1).strip() or f"Chapter {chapter_number}"
        else:
            data.title = first_line[:50].strip() or f"Chapter {chapter_number}"

    chapter = Chapter(
        novel_id=data.novel_id,
        number=chapter_number,
        title=data.title,
        source_text=data.content,
        word_count=len(data.content),
    )
    session.add(chapter)
    await session.flush()

    paragraphs = [p.strip() for p in data.content.splitlines() if p.strip()]
    for i, para in enumerate(paragraphs):
        segment = Segment(
            chapter_id=chapter.id,
            segment_number=i + 1,
            source_text=para,
            status="untouched",
        )
        session.add(segment)

    result = await session.execute(
        select(Character.name).where(Character.novel_id == data.novel_id)
    )
    existing_names = [row[0] for row in result.all()]
    from backend.utils import detect_japanese_names, detect_korean_names

    def run_all_detection(text: str, existing: list) -> list:
        names = []
        names.extend(detect_potential_characters(text, existing))
        names.extend(detect_japanese_names(text, existing))
        names.extend(detect_korean_names(text, existing))
        seen = set()
        deduped = []
        for n, c in names:
            if n not in seen:
                seen.add(n)
                deduped.append((n, c))
        return deduped

    if data.content and len(data.content) > 30:
        candidates = await asyncio.to_thread(run_all_detection, data.content, existing_names)
        for name, count in candidates:
            char = Character(
                novel_id=data.novel_id,
                name=name,
                name_variants=[name],
                gender="Unknown",
                role="Minor",
                status="Alive",
                traits={"detected_from": f"chapter_{chapter_number}", "frequency": count},
            )
            session.add(char)

    await session.commit()
    await session.refresh(chapter)

    seg_count = await session.scalar(
        select(func.count(Segment.id)).where(Segment.chapter_id == chapter.id)
    )

    return ChapterResponse(
        id=chapter.id,
        novel_id=chapter.novel_id,
        number=chapter.number,
        title=chapter.title,
        translated=chapter.translated or False,
        word_count=chapter.word_count or 0,
        segment_count=seg_count or 0,
    )


@router.get("/projects/{novel_id}/chapters", response_model=List[ChapterResponse])
async def list_chapters(novel_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(Chapter).where(Chapter.novel_id == novel_id).order_by(Chapter.number)
    )
    chapters = result.scalars().all()
    output = []
    for ch in chapters:
        seg_count = await session.scalar(
            select(func.count(Segment.id)).where(Segment.chapter_id == ch.id)
        )
        output.append(ChapterResponse(
            id=ch.id,
            novel_id=ch.novel_id,
            number=ch.number,
            title=ch.title,
            translated=ch.translated or False,
            word_count=ch.word_count or 0,
            segment_count=seg_count or 0,
        ))
    return output


@router.get("/chapters/{chapter_id}/segments", response_model=List[SegmentResponse])
async def list_segments(chapter_id: str, session: AsyncSession = Depends(get_session)):
    chapter = await session.get(Chapter, chapter_id)
    source_lang = "zh"
    if chapter:
        novel = await session.get(Novel, chapter.novel_id)
        if novel:
            source_lang = novel.source_lang

    result = await session.execute(
        select(Segment).where(Segment.chapter_id == chapter_id).order_by(Segment.segment_number)
    )
    segments = result.scalars().all()
    return [
        SegmentResponse(
            id=s.id,
            chapter_id=s.chapter_id,
            segment_number=s.segment_number,
            source_text=s.source_text,
            translation=s.translation or "",
            status=s.status,
            has_qa=s.has_qa or False,
            transliteration=transliterate(s.source_text, source_lang),
        )
        for s in segments
    ]


@router.post("/chapters/{chapter_id}/summarize")
async def summarize_chapter(chapter_id: str, session: AsyncSession = Depends(get_session)):
    chapter = await session.get(Chapter, chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    novel = await session.get(Novel, chapter.novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="Novel not found")

    result = await session.execute(
        select(Segment).where(Segment.chapter_id == chapter_id, Segment.translation != "").order_by(Segment.segment_number)
    )
    segments = result.scalars().all()
    text = " ".join(s.translation for s in segments if s.translation)

    if not text:
        return {"summary": "", "error": "No translated segments to summarize"}

    try:
        from litellm import acompletion
        from backend.api.settings import get_cached
        provider = get_cached("primary_provider", "ollama")
        model = get_cached("primary_model", "llama3:70b")
        base_url = get_cached("primary_base_url")
        api_key = get_cached("primary_api_key")

        known = {
            "openai": "https://api.openai.com/v1",
            "deepseek": "https://api.deepseek.com/v1",
            "ollama": "http://localhost:11434/v1",
        }

        prompt = f"Summarize this chapter of a {novel.genre or 'webnovel'} in 2-3 sentences. Focus on plot developments and character actions:\n\n{text[:2000]}"

        response = await acompletion(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=200,
            base_url=base_url or known.get(provider, "http://localhost:11434/v1"),
            api_key=api_key or None,
        )
        summary = response.choices[0].message.content.strip()

        previous = novel.summary or ""
        if previous:
            novel.summary = f"{previous.rstrip('.')}. {summary}"
        else:
            novel.summary = summary
        await session.commit()

        return {"summary": summary, "full_summary": novel.summary}
    except Exception as e:
        return {"summary": "", "error": str(e), "chapter_title": chapter.title}


class ChapterUpdate(BaseModel):
    title: Optional[str] = None


@router.put("/chapters/{chapter_id}", response_model=ChapterResponse)
async def update_chapter(chapter_id: str, data: ChapterUpdate, session: AsyncSession = Depends(get_session)):
    chapter = await session.get(Chapter, chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    if data.title is not None:
        chapter.title = data.title
    await session.commit()
    await session.refresh(chapter)
    seg_count = await session.scalar(
        select(func.count(Segment.id)).where(Segment.chapter_id == chapter.id)
    )
    return ChapterResponse(
        id=chapter.id,
        novel_id=chapter.novel_id,
        number=chapter.number,
        title=chapter.title,
        translated=chapter.translated or False,
        word_count=chapter.word_count or 0,
        segment_count=seg_count or 0,
    )


@router.delete("/chapters/{chapter_id}")
async def delete_chapter(chapter_id: str, session: AsyncSession = Depends(get_session)):
    chapter = await session.get(Chapter, chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    try:
        from backend.db.vector_store import _get_collection
        coll = _get_collection()
        coll.delete(where={"chapter_id": chapter_id})
    except Exception as e:
        print(f"[delete_chapter] TM cleanup error: {e}")
    await session.delete(chapter)
    await session.commit()
    return {"deleted": True}


@router.post("/chapters/{chapter_id}/reapply")
async def reapply_chapter(chapter_id: str, req: TranslateAllRequest, session: AsyncSession = Depends(get_session)):
    from backend.pipeline.chapter_translator import ChapterTranslator
    result = await session.execute(
        select(Segment).where(Segment.chapter_id == chapter_id)
    )
    segments = result.scalars().all()
    for seg in segments:
        seg.translation = ""
        seg.status = "untouched"
    await session.commit()

    ct = ChapterTranslator()
    try:
        result = await ct.translate_chapter(chapter_id=chapter_id, novel_id=req.novel_id)
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/projects/{novel_id}/reorder-chapters")
async def reorder_chapters(novel_id: str, data: dict, session: AsyncSession = Depends(get_session)):
    chapter_ids = data.get("chapter_ids", [])
    if not chapter_ids:
        raise HTTPException(status_code=400, detail="chapter_ids required")
    for idx, ch_id in enumerate(chapter_ids, 1):
        ch = await session.get(Chapter, ch_id)
        if ch and ch.novel_id == novel_id:
            ch.number = idx
    await session.commit()
    return {"reordered": len(chapter_ids)}


@router.get("/projects/{novel_id}/consistency-check")
async def consistency_check(novel_id: str, session: AsyncSession = Depends(get_session)):
    gloss_result = await session.execute(
        select(GlossaryTerm).where(GlossaryTerm.novel_id == novel_id)
    )
    glossary = gloss_result.scalars().all()
    if not glossary:
        return {"issues": []}

    ch_result = await session.execute(
        select(Segment.translation, Chapter.number)
        .select_from(Segment)
        .join(Chapter, Segment.chapter_id == Chapter.id)
        .where(Chapter.novel_id == novel_id, Segment.translation != "")
    )
    rows = ch_result.all()
    all_text = " ".join(row[0] for row in rows)

    issues = []
    for g in glossary:
        src = g.source_term
        tgt = g.target_term
        if src in all_text:
            issues.append({
                "type": "source_in_translation",
                "term": src,
                "expected": tgt,
                "detail": f"Source term '{src}' appears in translated text — may not have been replaced with '{tgt}'",
            })
        counts = {}
        for row in rows:
            text = row[0]
            if tgt.lower() in text.lower() or src.lower() in text.lower():
                ch_num = row[1]
                counts[ch_num] = counts.get(ch_num, 0) + 1

        source_count = sum(1 for row in rows if src.lower() in row[0].lower())
        target_count = sum(1 for row in rows if tgt.lower() in row[0].lower())
        if source_count > target_count * 2 and target_count > 0:
            issues.append({
                "type": "inconsistent_usage",
                "term": src,
                "expected": tgt,
                "detail": f"'{src}' used {source_count} times vs '{tgt}' {target_count} times in translations",
            })

    return {"issues": issues[:50]}


@router.post("/chapters/{chapter_id}/check-status")
async def check_chapter_status(chapter_id: str, session: AsyncSession = Depends(get_session)):
    chapter = await session.get(Chapter, chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    seg_count = await session.scalar(
        select(func.count(Segment.id)).where(Segment.chapter_id == chapter_id)
    )
    translated_count = await session.scalar(
        select(func.count(Segment.id)).where(
            Segment.chapter_id == chapter_id,
            Segment.status.in_(["translated", "needs_review"])
        )
    )
    all_done = seg_count and translated_count and seg_count == translated_count

    if all_done and not chapter.translated:
        chapter.translated = True
        await session.commit()
    elif not all_done and chapter.translated:
        chapter.translated = False
        await session.commit()

    return {
        "chapter_id": chapter_id,
        "total": seg_count or 0,
        "translated": translated_count or 0,
        "chapter_marked": chapter.translated or False,
    }
