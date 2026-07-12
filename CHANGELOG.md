# Changelog

## v0.5.0 (2026-07-12) — First Public Release

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
