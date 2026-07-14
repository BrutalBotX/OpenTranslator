import asyncio
import re
import time
from sqlalchemy import select, func

from backend.db.database import async_session
from backend.db.models import Segment, Chapter, Novel, QAItem, Character
from backend.pipeline.context_gatherer import ContextGatherer
from backend.pipeline.ambiguity_detector import AmbiguityDetector
from backend.pipeline.translator import Translator
from backend.db.vector_store import add_to_tm
from backend.api.settings import get_cached
from backend.utils.transliteration import transliterate
from backend.utils.logging import get_logger

log = get_logger()

SEG_PATTERN = re.compile(r'\[SEG (\d+)\]\s*[\r\n]+(.*?)(?=\[SEG \d+\]|\Z)', re.DOTALL)
WINDOW_SIZE = 3

_progress: dict[str, dict] = {}
_cancel_events: dict[str, asyncio.Event] = {}


def get_translate_progress(chapter_id: str) -> dict:
    return _progress.get(chapter_id, {
        "status": "idle", "current_batch": 0, "total_batches": 0,
        "llm_status": "", "error": "", "elapsed": 0,
    })


def cancel_translation(chapter_id: str):
    ev = _cancel_events.get(chapter_id)
    if ev is None:
        ev = asyncio.Event()
        ev.set()
        _cancel_events[chapter_id] = ev
    ev.set()
    _progress[chapter_id] = {
        **_progress.get(chapter_id, {}),
        "status": "cancelled", "llm_status": "cancelled",
    }


class ChapterTranslator:
    def __init__(self):
        self.context_gatherer = ContextGatherer()
        self.ambiguity_detector = AmbiguityDetector()
        self.translator = Translator()

    async def translate_chapter(self, chapter_id: str, novel_id: str) -> dict:
        batch_size = int(get_cached("batch_size", "4"))
        cancel_ev = asyncio.Event()
        _cancel_events[chapter_id] = cancel_ev

        async with async_session() as session:
            chapter = await session.get(Chapter, chapter_id)
            novel = await session.get(Novel, novel_id)
            if not chapter or not novel:
                return {"error": "Chapter or novel not found"}

            result = await session.execute(
                select(Segment).where(Segment.chapter_id == chapter_id)
                .order_by(Segment.segment_number)
            )
            segments = result.scalars().all()

        total = len(segments)
        total_qa = 0
        all_translations = [None] * total

        prefill_count = 0
        for s in segments:
            idx = s.segment_number - 1
            if s.translation:
                all_translations[idx] = {
                    "id": s.id, "segment_number": s.segment_number,
                    "source_text": s.source_text, "translation": s.translation,
                    "status": s.status or "translated", "has_qa": s.has_qa or False,
                    "transliteration": transliterate(s.source_text, novel.source_lang),
                }
                prefill_count += 1

        pending = [s for s in segments if not s.translation]
        if not pending:
            return self._result(all_translations, total, chapter, total_qa)

        _progress[chapter_id] = {
            "status": "gathering_context",
            "current_batch": 0,
            "total_batches": 0,
            "llm_status": "loading context...",
            "error": "",
            "started_at": time.time(),
            "prefilled": prefill_count,
        }

        novel_context = await self.context_gatherer.gather_async(
            chapter_id=chapter_id, novel_id=novel_id
        )

        batches = []
        for i in range(0, len(pending), batch_size):
            batch = []
            for j in range(i, min(i + batch_size, len(pending))):
                seg = pending[j]
                batch.append({
                    "id": seg.id,
                    "segment_number": seg.segment_number,
                    "source_text": seg.source_text,
                })
            batches.append((pending[i].segment_number - 1, batch))

        total_batches = len(batches)
        _progress[chapter_id] = {
            "status": "translating",
            "current_batch": 0,
            "total_batches": total_batches,
            "llm_status": "starting",
            "error": "",
            "started_at": time.time(),
            "prefilled": prefill_count,
        }

        for batch_index, (batch_start, segs) in enumerate(batches):
            if cancel_ev.is_set():
                log.info(f" Cancelled at batch {batch_index + 1}/{total_batches}")
                for seg_data in segs:
                    idx = seg_data["segment_number"] - 1
                    if all_translations[idx] is None:
                        all_translations[idx] = {
                            "id": seg_data["id"], "segment_number": seg_data["segment_number"],
                            "source_text": seg_data["source_text"], "translation": "",
                            "status": "untouched", "has_qa": False,
                            "transliteration": transliterate(seg_data["source_text"], novel_context.get("source_lang", "zh")),
                        }
                break

            all_text = " ".join(s["source_text"] for s in segs)

            context = self._build_batch_context(
                segments=segments, batch_start=batch_start, batch_size=len(segs),
                novel_context=novel_context,
            )

            issues = await self.ambiguity_detector.detect_async(
                text=all_text, context=context, novel_id=novel_id,
            )
            if issues:
                from backend.db.models import GlossaryTerm
                async with async_session() as sess:
                    existing_names = await sess.execute(
                        select(Character.name).where(Character.novel_id == novel_id)
                    )
                    existing_name_set = {row[0] for row in existing_names.all()}

                    existing_terms_result = await sess.execute(
                        select(GlossaryTerm.source_term).where(GlossaryTerm.novel_id == novel_id)
                    )
                    existing_terms_set = {row[0] for row in existing_terms_result.all()}

                    # Map each issue to the segment whose text contains its context snippet
                    for issue in issues:
                        ctx = issue.get("context", "")
                        target_seg_id = segs[0]["id"]
                        for s in segs:
                            if ctx and ctx in s["source_text"]:
                                target_seg_id = s["id"]
                                break

                        qtype = issue["type"]
                        qtext = issue["question"]
                        suggestions = issue.get("suggestions", [])
                        sess.add(QAItem(
                            segment_id=target_seg_id, question_type=qtype,
                            question=qtext, context_snippet=ctx,
                            suggestions=suggestions,
                        ))

                        if qtype == "Name":
                            m = re.search(r'"([^"]+)"', qtext)
                            if m:
                                name = m.group(1)
                                if name not in existing_name_set:
                                    from backend.utils.transliteration import suggest_gender
                                    gender = suggest_gender(name) or "Unknown"
                                    sess.add(Character(
                                        novel_id=novel_id, name=name,
                                        name_variants=[name], gender=gender,
                                        role="Potential", status="Pending Review",
                                    ))
                                    existing_name_set.add(name)

                        if qtype == "Cultural":
                            m = re.search(r'"([^"]+)"', qtext)
                            if m:
                                term = m.group(1)
                                if term not in existing_terms_set and len(term) >= 2:
                                    sess.add(GlossaryTerm(
                                        novel_id=novel_id,
                                        source_term=term,
                                        target_term=term,
                                        category="Term",
                                    ))
                                    existing_terms_set.add(term)

                    await sess.commit()
                total_qa += len(issues)

            _progress[chapter_id].update({
                "current_batch": batch_index + 1,
                "llm_status": f"calling LLM (batch {batch_index + 1}/{total_batches})",
            })
            log.info(f" Batch {batch_index + 1}/{total_batches} (segs {segments[batch_start].segment_number}-{segments[min(batch_start + len(segs) - 1, len(segments) - 1)].segment_number}) starting...")

            prompt = self.translator.prompt_builder.build_batch_prompt(
                batch_segments=segs, context=context,
            )

            batch_timeout = int(get_cached("llm_timeout", "60")) + 10
            try:
                async def _do_translate():
                    if cancel_ev.is_set():
                        raise asyncio.CancelledError()
                    return await self.translator.translate(text=prompt, context=context, is_batch=True)

                translated = await asyncio.wait_for(_do_translate(), timeout=batch_timeout)
            except asyncio.TimeoutError:
                err_msg = f"Batch {batch_index + 1}/{total_batches} timed out after {batch_timeout}s"
                log.info(f" {err_msg}, skipping")
                _progress[chapter_id].update({"llm_status": f"timeout on batch {batch_index + 1}", "error": err_msg})
                for seg_data in segs:
                    idx = seg_data["segment_number"] - 1
                    if all_translations[idx] is None:
                        all_translations[idx] = {
                            "id": seg_data["id"], "segment_number": seg_data["segment_number"],
                            "source_text": seg_data["source_text"], "translation": "",
                            "status": "needs_review", "has_qa": False,
                            "transliteration": transliterate(seg_data["source_text"], novel_context.get("source_lang", "zh")),
                        }
                continue
            except (asyncio.CancelledError, Exception) as e:
                if isinstance(e, (asyncio.CancelledError)) or cancel_ev.is_set():
                    log.info(f" Cancelled during batch {batch_index + 1}")
                    for seg_data in segs:
                        idx = seg_data["segment_number"] - 1
                        if all_translations[idx] is None:
                            all_translations[idx] = {
                                "id": seg_data["id"], "segment_number": seg_data["segment_number"],
                                "source_text": seg_data["source_text"], "translation": "",
                                "status": "untouched", "has_qa": False,
                                "transliteration": transliterate(seg_data["source_text"], novel_context.get("source_lang", "zh")),
                            }
                    break
                err_msg = f"Batch {batch_index + 1}/{total_batches} failed: {e}"
                log.info(f" {err_msg}")
                _progress[chapter_id].update({"llm_status": f"error on batch {batch_index + 1}", "error": err_msg})
                for seg_data in segs:
                    idx = seg_data["segment_number"] - 1
                    if all_translations[idx] is None:
                        all_translations[idx] = {
                            "id": seg_data["id"], "segment_number": seg_data["segment_number"],
                            "source_text": seg_data["source_text"], "translation": "",
                            "status": "needs_review", "has_qa": False,
                            "transliteration": transliterate(seg_data["source_text"], novel_context.get("source_lang", "zh")),
                        }
                continue

            parsed = self._parse_batch_response(translated, segs)

            async with async_session() as batch_sess:
                for seg_data in segs:
                    seg_num = seg_data["segment_number"]
                    translation = parsed.get(seg_num, "")
                    seg_id = seg_data["id"]
                    idx = seg_data["segment_number"] - 1

                    db_seg = await batch_sess.get(Segment, seg_id)
                    if db_seg:
                        db_seg.translation = translation
                        db_seg.status = "translated"

                    if translation:
                        await asyncio.to_thread(
                            add_to_tm, segment_id=seg_id,
                            source_text=seg_data["source_text"],
                            target_text=translation,
                            novel_id=novel_id, chapter_id=chapter_id,
                        )

                    quality_score = 1.0
                    if bool(issues):
                        quality_score -= 0.2
                    if translation and seg_data["source_text"]:
                        ratio = max(len(seg_data["source_text"]), 1) / max(len(translation), 1)
                        if ratio < 0.3 or ratio > 5:
                            quality_score -= 0.15
                    if quality_score < 0: quality_score = 0

                    all_translations[idx] = {
                        "id": seg_id, "segment_number": seg_num,
                        "source_text": seg_data["source_text"], "translation": translation,
                        "status": "translated", "has_qa": bool(issues),
                        "quality": round(quality_score, 2),
                        "transliteration": transliterate(seg_data["source_text"], novel_context.get("source_lang", "zh")),
                    }

                    if translation and novel_context.get("glossary"):
                        src_lower = seg_data["source_text"].lower()
                        tgt_lower = translation.lower()
                        for g in novel_context["glossary"]:
                            gsrc = g.get("source_term", "").lower()
                            gtgt = g.get("target_term", "").lower()
                            if gsrc and gtgt and gsrc in src_lower and gtgt not in tgt_lower and gsrc in tgt_lower:
                                dupe = await batch_sess.execute(
                                    select(QAItem).where(
                                        QAItem.segment_id == seg_id,
                                        QAItem.question.contains(g["source_term"]),
                                    )
                                )
                                if dupe.scalar_one_or_none():
                                    continue
                                total_qa += 1
                                batch_sess.add(QAItem(
                                    segment_id=seg_id, question_type="Cultural",
                                    question=f'Glossary term "{g["source_term"]}" may not have been translated to "{g["target_term"]}" in output.',
                                    context_snippet=f'Source: {seg_data["source_text"][:100]}',
                                    suggestions=[f"Replace with {g['target_term']}", "Keep as-is", "Add alias"],
                                ))

                await batch_sess.commit()

            translated_count = len([t for t in all_translations if t and t.get("translation")])
            log.info(f" Batch {batch_index + 1}/{total_batches} done ({translated_count}/{total} translated so far)")
            _progress[chapter_id].update({"llm_status": "done"})

        # Fill remaining None entries for cancelled segments
        if cancel_ev.is_set():
            for idx in range(total):
                if all_translations[idx] is None:
                    seg = segments[idx]
                    all_translations[idx] = {
                        "id": seg.id, "segment_number": seg.segment_number,
                        "source_text": seg.source_text, "translation": seg.translation or "",
                        "status": seg.status or "untouched", "has_qa": False,
                        "transliteration": transliterate(seg.source_text, novel.source_lang),
                    }

        is_cancelled = cancel_ev.is_set()
        _progress[chapter_id].update({
            "status": "cancelled" if is_cancelled else "done",
            "llm_status": "cancelled" if is_cancelled else "completed",
            "elapsed": time.time() - _progress[chapter_id].get("started_at", time.time()),
        })

        translated_count = len([t for t in all_translations if t and t.get("translation")])
        log.info(f" {'Cancelled' if is_cancelled else 'Done'}: {translated_count}/{total} segments, {total_qa} QA items in {_progress[chapter_id]['elapsed']:.1f}s")

        if not is_cancelled:
            async with async_session() as session:
                db_chapter = await session.get(Chapter, chapter_id)
                if db_chapter:
                    db_chapter.translated = True
                    await session.commit()

                backup_intra = int(get_cached("auto_backup_interval", "0"))
                if backup_intra > 0:
                    cnt = await session.scalar(
                        select(func.count(Chapter.id)).where(
                            Chapter.novel_id == novel_id, Chapter.translated == True
                        )
                    )
                    if cnt and cnt % backup_intra == 0:
                        _progress[chapter_id]["trigger_backup"] = True

        _cancel_events.pop(chapter_id, None)
        _progress.pop(chapter_id, None)

        return self._result(all_translations, total, chapter, total_qa)

    def _result(self, all_translations, total, chapter, total_qa):
        segments = []
        for t in all_translations:
            if t:
                t["chapter_id"] = str(chapter.id)
                segments.append(t)
        return {
            "segments": segments,
            "total": total,
            "chapter_title": chapter.title,
            "chapter_number": chapter.number,
            "qa_count": total_qa,
        }

    async def apply_qa(self, chapter_id: str, novel_id: str) -> dict:
        batch_size = int(get_cached("batch_size", "4"))

        async with async_session() as session:
            result = await session.execute(
                select(Segment).where(Segment.chapter_id == chapter_id)
                .order_by(Segment.segment_number)
            )
            segments = result.scalars().all()

            seg_ids = [s.id for s in segments]
            qa_result = await session.execute(
                select(QAItem).where(
                    QAItem.segment_id.in_(seg_ids),
                    QAItem.resolved == True,
                )
            )
            qa_items = qa_result.scalars().all()

        if not qa_items:
            return {"segments": [], "applied": 0}

        novel_context = await self.context_gatherer.gather_async(
            chapter_id=chapter_id, novel_id=novel_id
        )

        updated_seg_ids = set(q.segment_id for q in qa_items)
        target_segs = [s for s in segments if s.id in updated_seg_ids]

        reapplied = []
        async with async_session() as apply_session:
            for i in range(0, len(target_segs), batch_size):
                batch_segs = target_segs[i:i + batch_size]
                batch_seg_data = [
                    {"id": s.id, "segment_number": s.segment_number, "source_text": s.source_text}
                    for s in batch_segs
                ]

                batch_start = min(s.segment_number - 1 for s in batch_segs)
                context = self._build_batch_context(
                    segments=segments,
                    batch_start=batch_start,
                    batch_size=len(batch_segs),
                    novel_context=novel_context,
                )
                context["qa_applied"] = True

                prompt = self.translator.prompt_builder.build_batch_prompt(
                    batch_segments=batch_seg_data, context=context,
                )

                translated = await self.translator.translate(
                    text=prompt, context=context, is_batch=True,
                )
                parsed = self._parse_batch_response(translated, batch_seg_data)

                for seg in batch_segs:
                    translation = parsed.get(seg.segment_number, "")
                    db_seg = await apply_session.get(Segment, seg.id)
                    if db_seg:
                        db_seg.translation = translation or db_seg.translation
                        db_seg.status = "needs_review"
                        db_seg.has_qa = False

                    reapplied.append({
                        "id": seg.id, "segment_number": seg.segment_number,
                        "source_text": seg.source_text,
                        "translation": translation or seg.translation,
                        "status": "needs_review",
                    })

            await apply_session.commit()
        return {"segments": reapplied, "applied": len(reapplied)}

    def _parse_batch_response(self, response: str, batch_segments: list) -> dict:
        result = {}
        for match in SEG_PATTERN.finditer(response):
            seg_num = int(match.group(1))
            text = match.group(2).strip()
            if text:
                result[seg_num] = text
        if not result:
            parts = [p.strip() for p in response.split("\n\n") if p.strip()]
            for i, seg in enumerate(batch_segments):
                seg_num = seg["segment_number"]
                text = parts[i] if i < len(parts) else ""
                if text:
                    result[seg_num] = text
        if not result:
            log.warning(f"Failed to parse LLM response for batch of {len(batch_segments)} segments. Response: {response[:200]}")
        return result

    def _build_batch_context(self, segments: list, batch_start: int, batch_size: int, novel_context: dict) -> dict:
        context = dict(novel_context)

        prev_start = max(0, batch_start - WINDOW_SIZE)
        previous = []
        for j in range(prev_start, batch_start):
            prev = segments[j]
            previous.append({"source_text": prev.source_text, "translation": prev.translation or ""})

        next_start = batch_start + batch_size
        next_end = min(len(segments), next_start + WINDOW_SIZE)
        next_segments = []
        for j in range(next_start, next_end):
            nxt = segments[j]
            next_segments.append({"source_text": nxt.source_text})

        context["sliding_window"] = {
            "previous_translations": previous,
            "next_sources": next_segments,
            "current_index": batch_start + 1,
            "total_segments": len(segments),
        }

        return context
