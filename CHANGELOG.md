# Changelog

## v0.6.6 (2026-07-15)

### UI
- **Fixed version display** — `version.json` imported at build time, loading overlay shows real version instead of `0.0.0`
- **Simplified loading labels** — "Starting Python backend..." → "Initializing...", "Loading translation memory..." → "Loading..."

### Infrastructure
- **`.gitignore`** — added `logs/` and `*.novelproj`
- **bump script** — fixed changelog insertion positioning and `bumped from X to X` reporting the same version

## v0.6.5 (2026-07-15)

### Bug Fixes
- **CRITICAL**: Fixed missing `import asyncio` in `context_gatherer.py` — single-segment `/api/translate` was crashing with `NameError`
- **CRITICAL**: Fixed `batch_answer_and_classify` missing `session.commit()` — all QA answers, character/gender changes silently lost
- **CRITICAL**: Fixed `loadSegments` abort using stale `activeChapterId` — rapid chapter switching no longer shows wrong segments
- **CRITICAL**: Fixed ChapterNav rename using non-existent `fetchChapters` named export — rename now refreshes the list via store
- **CRITICAL**: Fixed IPC path ignoring AbortSignal — timeouts now work correctly in Electron builds via `_timeout` parameter
- Fixed case-sensitive `==` character/term lookups (changed to `.ilike()`) eliminating duplicate entries
- Fixed instructions/actions saved in separate transactions — now single transaction, consistent on failure
- Fixed Pydantic `str` fields without defaults on `CharacterResponse` and `GlossaryResponse` — no more 500 on `NULL` from DB
- Fixed `str(e)` leaking API keys/paths to client — added `sanitize_error()` with regex redaction + truncation
- Fixed multiple internal commits in `_apply_answer_to_db` — consistent transaction boundaries, callers manage commits
- Fixed `answer_question` missing `session.commit()` (was relying on `_apply_answer_to_db`'s removed internal commit)
- Fixed `novel` store reference in useEffect dependency array — caused `clear()` + state loss on every unrelated store update
- Fixed `handleReapply` lacking concurrent translation guard — added `if (translatingChapter) return`
- Fixed missing `chapter_id` field in translation result segments (violated frontend `Segment` interface)
- Fixed `apply_qa` opening 1 DB session per segment — now uses single session for entire batch loop
- Fixed cancellation returning `segments` list shorter than `total` — remaining `None` entries filled as untouched
- Fixed `cancelTranslation` leaking AbortController in `_activeControllers` map
- Fixed ContextPanel context fetch race on rapid chapter switching — request counter discards stale responses
- Fixed consistency check errors silently showing "No issues found" — added error state with distinct UI
- Added user-visible error feedback for export failures

## v0.6.4 (2026-07-15)

### Bug Fixes
- Fixed QA items attributed to wrong segment (all mapped to batch's first segment regardless of position)
- Fixed sync ChromaDB call (`search_similar`) blocking event loop in `gather_async` — wrapped in `asyncio.to_thread`
- Fixed `loadSegments` race condition on rapid chapter switching — AbortController per chapter, request counter validation
- Fixed `atob(null)` crash on EPUB export — added null guard before `atob()`
- Fixed IPC path timeout being a no-op (`signal?.dispatchEvent` is not a function on AbortSignal) — proper `_timeout` forwarding
- Fixed `_get_collection()` thread safety — added `_collection_lock` with double-checked locking
- Fixed fire-and-forget asyncio task in startup — task now stored in `_init_tasks` set with done callback
- Fixed `_progress` dict memory leak — `_progress.pop(chapter_id)` after translation completes
- Fixed duplicate glossary-mismatch QA items across batches — `SELECT` check before insert
- Fixed log file growing unbounded — `FileHandler` replaced with `RotatingFileHandler(10MB, 3 backups)`
- Fixed `fetchModels` race when rapidly switching providers — AbortController stored, aborted before new fetch
- Fixed export button not disabled during translation — button greyed out, dropdown hidden

### UI
- Improved light theme: `filter: invert(0.92)` reduced intensity, SVGs/lucide-icons re-inverted via broader selector

## v0.6.3 (2026-07-15)

### Bug Fixes
- Fixed Accept button not saving edited text — textarea now syncs edits to store via `onEdit`, Accept sends edited text
- Fixed translation progress display showing nothing — added `llmStatus: 'initializing...'` immediately, 800ms minimum duration
- Fixed pinyin breaking Latin text into individual letters — `transliterate_zh()` splits CJK/non-CJK runs
- Fixed glossary inline edit broken — `context_gatherer.py` now includes `id` in glossary dicts
- Fixed translation page not resetting when switching projects — `translationStore.clear()` called on novelId change
- Fixed keyboard shortcut effect running on every render — refactored to `useRef` pattern with `[]` deps
- Added AbortController to `translateChapter` preventing stale responses overwriting new chapter state
- Fixed health check HTTP response socket leak — `consumeResponse()` drains response streams
- Added hover tooltips to all toolbar buttons (Import, Translate, Apply, View, Export, Check, Save, Edit, Accept, Reset, Presets, Prompt)
- Fixed chapter auto-naming — frontend sends empty title, backend regex detects from first line
- Fixed gender auto-suggest showing rationale — `infer_gender()` returns `{gender, reason}`, "auto-suggested" badge with tooltip
- Fixed chapter rename using `window.location.reload()` — now calls `fetchChapters()` from store

### Features
- Rename projects & chapters: `PUT /projects/{id}` and `PUT /chapters/{id}` endpoints + inline click-to-edit in UI
- Show raw source segments in translate view (replaced empty hero UI with read-only segment list)
- Glossary inline edit in GlossaryPanel (previously only Add/Delete buttons)
- Auto-backup setting exposed in Settings UI, manual Save button in toolbar

## v0.6.2 (2026-07-15)

### Architecture Improvements
- Version check enforced via `prebuild` lifecycle hook for all dist commands
- Updated CHECKLIST.md — all 33 items verified

---

## v0.6.0 (2026-07-12) — First Public Release

### Features
- **Batch chapter translation** — translate entire chapters at once with configurable batch size (1–10 segments per LLM call)
- **15+ LLM providers** — Ollama (local), OpenAI, Anthropic, DeepSeek, Google Gemini, Groq, Mistral, Together AI, Perplexity, Cohere, OpenCode Zen/Go, xAI, OpenRouter, Fireworks, Deep Infra, custom endpoints
- **Sliding window context** — each batch sees 3 previous + 3 upcoming segments for coherent flow
- **Persistent character management** — auto-detect characters on chapter import (Chinese, Japanese, Korean), edit modal with gender/role/status/variants, gender suggestion from name
- **Glossary** — auto-populate cultivation terms and cultural vocabulary during translation
- **QA Queue** — ambiguity detection flags pronouns, unknown names, idioms, cultural terms without blocking translation; batch-resolve by type with one click
- **Translator instructions** — per-project instruction box with "View prompt" preview showing combined instructions + characters + glossary for transparency
- **Transliteration** — proper pinyin with accent marks (nǐ hǎo), Japanese romaji via pykakasi, Korean romanization
- **Translation memory** — ChromaDB vector store upserts for style consistency across chapters
- **Live progress tracking** — real-time batch progress, LLM status, segment count; cancel button to abort mid-translation
- **Resume support** — skips already-translated segments on re-translate
- **Configurable timeout** — per-provider LLM timeout setting (10–300s, default 60) prevents stuck translations
- **Re-apply** — clear all translations and re-translate with updated instructions/characters/glossary
- **Inline review** — edit/accept/reset per segment, Apply QA Answers button batches re-translations
- **Delete chapter** — with ChromaDB TM cleanup and confirmation dialog
- **Export** — plain text, HTML (escaped), markdown formats
- **.novelproj cache** — full project export/import with auto-save after translation

### UI/UX
- **Horizontal toolbar** — Import, Translate, Apply, Review toggle, Export TXT/HTML
- **Thin chapter sidebar** — full name wrapping, hover tooltip, delete on hover
- **Context panel** — draggable divider between context data and instructions pane
- **Startup overlay** — step-by-step progress (Python backend → ChromaDB → Ready)
- **Error boundary** — catches render crashes with retry button (no more white screens)
- **Sidebar navigation** — Projects tab always visible, project-specific tabs only when a novel is loaded
- **Electron menu removed** — no more File/Edit/View default menu bar

### Under The Hood
- **Error handling overhaul** — all API calls validate response shapes, ErrorBoundary wraps routes, poll race conditions fixed
- **Performance** — N+1 chapter count queries fixed (subquery join), per-segment DB sessions consolidated to batch-level, fine-grained Zustand selectors
- **Security** — HTML escaping in exporter (XSS fix), API key moved from URL to header (Google Gemini), SSRF prevention on `base_url`, sanitized mass-assignment in project import
- **Dead code removed** — 7 unused components/files deleted (~2000 lines)
- **Detector improvements** — pronoun proximity merging (150 chars) for all languages, Japanese/Korean name detection on chapter import, auto-character creation from Name QA items
- **QA deduplication** — identical QA items grouped with occurrence count (×(N) occurrences — answer once for all)
- **Closed session bug fixed** — glossary creation now lives inside active session block (was crashing with ResourceClosedError)
- **IPC timeout synced** — 300s with backend's own `llm_timeout` handling
- **Backend stderr captured** — on exit failure, last 500 chars of stderr shown in error overlay

### Known Issues
- ChromaDB ONNX warning appears once on first startup (harmless, suppressed to FATAL)
- EPUB export returns markdown (proper EPUB generation planned)
- Version string is hardcoded in frontend components (dynamic version planned)
