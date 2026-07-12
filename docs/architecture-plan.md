# OpenTranslator — Architecture & Implementation Plan

An AI-assisted webnovel translation workstation with persistent narrative context and proactive ambiguity resolution.

---

## 1. Core Concept

An AI-assisted translation workstation that maintains persistent **narrative context** (characters, plot, world-building, terminology) and **proactively asks** the human translator when it encounters ambiguity — rather than guessing and making mistakes.

### Key Principles
- **Context-aware**: Every translation call is enriched with relevant character states, plot summaries, glossary terms, and similar past translations.
- **Ask, don't guess**: When the system detects ambiguity (unknown pronouns, new names, idioms, cultural terms), it pauses and asks the translator via a QA queue.
- **Local-first**: All data lives in a portable SQLite project file. No cloud dependency.
- **Multi-LLM**: Supports 15+ providers including local (Ollama) and cloud APIs.
- **Batch translation**: Multiple segments are batched per LLM call to reduce latency.

---

## 2. System Architecture (High-Level)

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend (Electron + React)             │
│  ┌──────────┐ ┌──────────────┐ ┌────────────────────┐  │
│  │ Chapters │  │ Translate /  │  │ Characters,        │  │
│  │ Sidebar  │  │ Review Pane  │  │ Glossary, QA,      │  │
│  │          │  │ Context Bar  │  │ Context Panel      │  │
│  └──────────┘ └──────────────┘ └────────────────────┘  │
│  ┌──────────┐ ┌──────────────┐ ┌────────────────────┐  │
│  │ Loading  │  │ Status Bar   │  │ Completion Popup   │  │
│  │ Overlay  │  │ (progress)   │  │ (after translate)  │  │
│  └──────────┘ └──────────────┘ └────────────────────┘  │
└───────────────────────┬─────────────────────────────────┘
                        │ IPC Bridge (preload.ts)
                        │ HTTP (localhost:8712)
┌───────────────────────┴─────────────────────────────────┐
│                  Backend (Python / FastAPI)                │
│  ┌───────────────┐ ┌────────────────┐ ┌──────────────┐  │
│  │ Chapter       │ │ Context        │ │ Ambiguity    │  │
│  │ Translator    │ │ Gatherer       │ │ Detector     │  │
│  │ (batch + QA)  │ │ (char/glossary)│ │ → QA queue   │  │
│  └───────────────┘ └────────────────┘ └──────────────┘  │
│  ┌───────────────┐ ┌────────────────┐ ┌──────────────┐  │
│  │ LLM Router    │ │ Translation    │ │ Settings +   │  │
│  │ (15 providers)│ │ Memory         │ │ Init Status  │  │
│  └───────────────┘ └────────────────┘ └──────────────┘  │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────┴─────────────────────────────────┐
│                Data Layer (SQLite + ChromaDB)             │
│  novels │ chapters │ segments │ characters │ glossary   │
│  plot_arcs │ tm_segments │ qa_queue │ settings          │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Project Structure

```
opentranslator/
├── electron/                    # Electron main process
│   ├── main.ts                  # App entry, backend spawn, health check
│   ├── preload.ts               # IPC bridge (secure)
│   └── ipc/
│       ├── file-handlers.ts     # Open/save project files, import chapter
│       └── llm-handlers.ts      # Proxy LLM calls (avoid CORS)
│
├── src/renderer/                # React renderer (TypeScript)
│   ├── App.tsx                  # Router, backend status polling, ChromaDB init
│   ├── layouts/
│   │   └── WorkspaceLayout.tsx  # Sidebar + main + status bar + loading overlay
│   ├── pages/
│   │   ├── ProjectHome.tsx      # Novel list, create/open/delete with confirmation
│   │   ├── TranslateView.tsx    # Dual mode: translate → review, horizontal toolbar
│   │   ├── CharactersPanel.tsx  # Character CRUD with edit modal + transliteration
│   │   ├── GlossaryPanel.tsx    # Glossary CRUD
│   │   ├── QAPanel.tsx          # QA queue with grouping + batch resolve
│   │   └── SettingsPage.tsx     # LLM config, batch size slider, timeout slider
│   ├── components/
│   │   ├── ErrorBoundary.tsx    # Catches render crashes, shows retry UI
│   │   ├── EditorPane.tsx       # Source text with glossary highlighting
│   │   ├── ChapterReviewPane.tsx # Review mode with edit/accept/apply QA
│   │   ├── ChapterNav.tsx       # Chapter list (thin sidebar) with delete
│   │   ├── ContextPanel.tsx     # Characters, glossary, plot arcs + InstructionBox
│   │   ├── ContextBar.tsx       # Status bar at top of translate view
│   │   ├── StatusBar.tsx        # Bottom bar: backend status, activity, progress
│   │   ├── LoadingOverlay.tsx   # Startup steps (Python → ChromaDB → Ready)
│   │   ├── InstructionBox.tsx   # Per-project instruction editor + prompt preview
│   │   └── TranslationCompletePopup.tsx  # Modal after chapter translates
│   ├── stores/                  # Zustand state management
│   │   ├── projectStore.ts      # Current project/novel state + .novelproj save
│   │   ├── translationStore.ts  # Segments, view mode, translate error, llmStatus
│   │   ├── statusStore.ts       # Backend status, activity, progress bar
│   │   └── settingsStore.ts     # LLM configs, batch size, language prefs
│   ├── services/
│   │   └── apiClient.ts         # API client via IPC bridge (120s timeout)
│
├── backend/                     # Python backend (FastAPI)
│   ├── main.py                  # App entry, startup events, health check, DB migration
│   ├── config.py                # Settings, env vars
│   ├── api/
│   │   ├── translate.py         # Translate-all, apply-qa, reapply, progress, cancel
│   │   ├── context.py           # GET /context/{chapter_id}
│   │   ├── characters.py        # CRUD /characters + gender suggestion + transliteration
│   │   ├── glossary.py          # CRUD /glossary
│   │   ├── questions.py         # QA queue + batch answer/dismiss/classify
│   │   ├── projects.py          # CRUD projects, chapters, segments, import, export/import-proj
│   │   ├── settings.py          # Settings CRUD, model fetch, llm-config, llm_timeout
│   │   ├── startup.py           # ChromaDB background init with timeout
│   │   └── export.py            # HTML, plaintext, markdown export
│   ├── pipeline/
│   │   ├── chapter_translator.py # Batch translation, progress tracking, cancel, auto-char/glossary
│   │   ├── pipeline.py          # Single-segment translation pipeline
│   │   ├── context_gatherer.py  # Assembles context block (chars, glossary, TM, instructions)
│   │   ├── ambiguity_detector.py # Flags issues → creates QA items (pronoun proximity merge)
│   │   ├── translator.py        # LLM translation call (batch-aware)
│   │   └── post_processor.py    # Consistency checks
│   ├── llm/
│   │   ├── router.py            # Litellm multi-provider router (with timeout)
│   │   ├── prompts.py           # System/user prompts, batch prompts, instructions injection
│   │   └── providers.py         # 15 providers with default models + base URLs
│   ├── detectors/
│   │   ├── base.py              # Abstract detector + merge_pronoun_issues()
│   │   ├── zh.py                # Chinese (chengyu, pronouns, names, cultivation terms)
│   │   ├── ja.py                # Japanese (honorifics, pronouns)
│   │   ├── ko.py                # Korean (honorifics)
│   │   └── registry.py          # Detector lookup by language
│   ├── db/
│   │   ├── database.py          # SQLAlchemy + SQLite setup
│   │   ├── models.py            # ORM models (all tables)
│   │   ├── vector_store.py      # ChromaDB for TM (upsert, get_or_create_collection)
│   │   └── migrations/          # Alembic auto-generated migration
│   ├── export/
│   │   ├── epub.py              # Markdown export (placeholder)
│   │   ├── html.py              # HTML export with escaping
│   │   └── plaintext.py         # Plaintext export
│   └── utils/                   # Package with helpers
│       ├── __init__.py          # CJK name detection (zh/ja/ko), culture sets
│       ├── transliteration.py   # Pinyin (accent marks), pykakasi romaji, hangul
│       └── instructions.py      # Parse "Replace name X with Y", alias commands
│
├── docs/
│   └── architecture-plan.md     # This file
├── data/                        # Runtime data (gitignored)
│   ├── projects/                # SQLite database
│   └── chroma/                  # ChromaDB persistence
│
├── package.json
├── requirements.txt
├── pyproject.toml
├── electron-builder.yml
├── alembic.ini
└── .gitignore
```

---

## 4. Chapter Translation Flow (One-Click)

The user clicks "Translate Chapter" → the backend translates all segments with sliding-window context, ambiguity detection, and batch processing.

```
   User clicks "Translate Chapter"
        │
        ▼
   ┌────────────────────────────────────────────────────┐
   │ 1. Load all segments for the chapter (N total)      │
   │ 2. Gather novel context (characters, glossary,      │
   │    plot arcs, translation memory)                   │
   └────────────────────┬───────────────────────────────┘
                        ▼
   ┌────────────────────────────────────────────────────┐
   │ 3. Split into batches of batch_size (default: 4)    │
   │                                                     │
   │    Batch 1: [S1, S2, S3, S4]  → 1 LLM call         │
   │    Batch 2: [S5, S6, S7, S8]  → 1 LLM call         │
   │    ...                                              │
   │                                                     │
   │    Each batch prompt includes:                      │
   │      ┌──────────────────────────────────────────┐   │
   │      │ [SEG 1] source text                      │   │
   │      │ [SEG 2] source text                      │   │
   │      │ ...                                      │   │
   │      │ Previous batch translations (context)    │   │
   │      │ Novel context (characters, glossary)      │   │
   │      └──────────────────────────────────────────┘   │
   └────────────────────┬───────────────────────────────┘
                        ▼
   ┌────────────────────────────────────────────────────┐
   │ 4. Parse response using [SEG N] delimiters          │
   │ 5. Run ambiguity detection (per segment, async)     │
   │ 6. Save each translation + add to TM                │
   │ 7. Mark chapter as translated                       │
   └────────────────────┬───────────────────────────────┘
                        ▼
   ┌────────────────────────────────────────────────────┐
   │ 8. Show completion popup with preview               │
   │ 9. User can review/edit in Review mode              │
   │ 10. Apply QA Answers button re-translates segments  │
   │     with resolved character/glossary context        │
   └────────────────────────────────────────────────────┘
```

### Sliding Window Context Design

```
When translating Batch N (segments X through X+3):

  ┌──────────────────────────────────────────────────────┐
  │ PREVIOUS CONTEXT (3 segments before batch)           │
  │   S(N-3) source + translation                        │
  │   S(N-2) source + translation                        │
  │   S(N-1) source + translation                        │
  │                                                      │
  │ CURRENT BATCH (segments to translate)                 │
  │   [SEG X] source text     → [SEG X] translation      │
  │   [SEG X+1] source text   → [SEG X+1] translation    │
  │   [SEG X+2] source text   → [SEG X+2] translation    │
  │   [SEG X+3] source text   → [SEG X+3] translation    │
  │                                                      │
  │ UPCOMING CONTEXT (3 segments after batch)            │
  │   S(N+1) source text (for context only)              │
  │   S(N+2) source text (for context only)              │
  │   S(N+3) source text (for context only)              │
  │                                                      │
  │ NOVEL CONTEXT (applied to all batches)               │
  │   Characters (name, gender, role, current state)     │
  │   Glossary terms relevant to current batch           │
  │   Plot arc summary                                   │
  │   Chapter title + number                             │
  └──────────────────────────────────────────────────────┘
```

### Batching Optimization

The `batch_size` setting controls how many segments are sent per LLM call:

| batch_size | Calls for 100 segs | Quality Risk |
|------------|-------------------|--------------|
| 1 | 100 calls | None (same as original) |
| 2 | 50 calls | Very low |
| **4** (default) | **25 calls** | **Low — recommended balance** |
| 6 | 17 calls | Medium |
| 8 | 13 calls | May skip/mix segments |
| 10 | 10 calls | High — not recommended |

Setting is configurable via Settings → Translation Speed slider (1-10). Values above 6 show a warning.

---

## 5. Translation Pipeline (Single Segment)

The original single-segment pipeline is still used for the "Apply QA" and legacy per-segment translate.

```
   Source Text  →  1. Context Gatherer  →  2. Ambiguity Detection  →  3. LLM Translate  →  4. Save + TM
                          │                        │
                     Characters,                Creates QA items
                     glossary, TM,             (continues despite issues)
                     plot arcs
```

---

## 6. LLM Router (15 Providers)

| Provider | Base URL | Default Model | Pricing |
|----------|----------|---------------|---------|
| Ollama | `http://localhost:11434/v1` | `llama3:70b` | Free · Local |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o` | Paid |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` | Paid |
| Anthropic | `https://api.anthropic.com/v1` | `claude-sonnet-4-20250514` | Paid |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta` | `gemini-2.0-flash` | Paid · Free tier |
| Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` | Paid |
| Mistral | `https://api.mistral.ai/v1` | `mistral-large-latest` | Paid |
| Together | `https://api.together.xyz/v1` | `meta-llama/llama-3.3-70b-instruct-turbo` | Paid |
| Perplexity | `https://api.perplexity.ai` | `sonar-pro` | Paid |
| Cohere | `https://api.cohere.com/v1` | `command-r-plus` | Paid · Free tier |
| OpenCode Zen | `https://opencode.ai/zen/v1` | `openai/deepseek-v4-pro` | Paid · Aggregator |
| OpenCode Go | `https://opencode.ai/zen/go/v1` | `openai/deepseek-v4-pro` | Paid · Subscription |
| xAI | `https://api.x.ai/v1` | `grok-2` | Paid |
| OpenRouter | `https://openrouter.ai/api/v1` | `openai/gpt-4o` | Paid · Aggregator |
| Fireworks | `https://api.fireworks.ai/inference/v1` | `accounts/fireworks/models/qwen3-70b` | Paid |
| Deep Infra | `https://api.deepinfra.com/v1/openai` | `meta-llama/llama-3.3-70b-instruct` | Paid |
| Custom | User-defined | User-defined | Varies |

Router capabilities:
- **Fallback**: If primary fails, automatically retries with fallback provider
- **Per-task routing**: Different models for translation vs. ambiguity detection
- **Context-aware selection**: Routes to models that can handle context length

---

## 7. Context Injection into AI Prompts

### System Prompt
```
You are translating a {source_lang} webnovel into {target_lang}.
Genre: {genre}.
Rules:
- Maintain the original meaning, style, and tone
- Keep character names in their original form
- Use the glossary for consistent terminology
- Follow pronoun resolution rules for characters

--- NOVEL CONTEXT ---
Chapter: {title} (#{number})
Story so far: {summary[:300]}

--- CHARACTERS ---
- {name} (role, gender, status) — {state_summary}

--- GLOSSARY ---
- {source_term} → {target_term} ({category})
```

### User Prompt (Batch Mode)
```
--- PREVIOUS TRANSLATIONS (for flow context) ---
[Segment N-2 translation]
[Segment N-1 translation]

--- UPCOMING TEXT (for context only) ---
[Segment N+1 source]

Active characters in scene: ...

Glossary terms used below: ...

Translate the following 4 segments. Keep the numbering.

[SEG 1] source text
[SEG 2] source text
[SEG 3] source text
[SEG 4] source text

--- OUTPUT FORMAT ---
Return each translation with its [SEG N] tag.
[SEG 1]
(translation)
[SEG 2]
(translation)
...
```

### User Prompt (Single Segment)
```
Active characters in scene: ...
Glossary terms in this text: ...

--- SIMILAR PAST TRANSLATIONS (reference) ---
Source: ...
→ Translation: ...

Translate the following text:
{text}
```

---

## 8. Ambiguity Detection + QA Flow

### When ambiguity is detected during chapter translation:
1. `AmbiguityDetector.detect_async()` scans each segment
2. If issues found → creates QAItem records in the database
3. Translation **still proceeds** (doesn't block like the old pipeline)
4. Segments with issues are marked `needs_review` with `has_qa=true`
5. QA count is shown in the completion popup

### QA Answer Flow

Each QA item shows:
- **Source text** — The original segment text
- **Absolute translation** — The AI's translation of the segment (literal)
- **Question** — What the AI doesn't understand (pronoun, name, etc.)
- **Suggestions** — Quick-answer buttons

When answered:
- **"Save"** — Records the answer, auto-updates character/glossary if applicable
- **"Answer & Re-translate"** — Records answer + re-translates the segment with updated context
- **"Skip"** — Dismisses the question

### Apply QA Answers (Review Tab)

The "Apply QA Answers" button in the review tab:
1. Collects all resolved QA items for the current chapter
2. Re-translates affected segments with the QA-answer-enriched context
3. Characters/genders/glossary are now known, producing better translations

### Triggers

| Trigger | Example | Question |
|---------|---------|----------|
| Unknown pronoun | 他/她/它 | "Which character does '她' refer to?" |
| New character name | 张三 (not in DB) | "New name '张三'. Character? Gender?" |
| Chengyu/idiom | 画蛇添足 | "Idiom detected. Translation approach?" |
| Cultivation term | 丹田, 筑基 | "Term detected. How to translate?" |
| Ambiguous gender | No pronouns in description | "What gender is [Character]?" |

---

## 9. Data Models

### Novels
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| title | str | Novel title |
| source_lang | str | "zh", "ja", "ko" |
| target_lang | str | "en" |
| genre | str | xianxia, fantasy, etc. |
| summary | text | Running plot summary (auto-updated) |

### Chapters
| Field | Type |
|-------|------|
| id | UUID |
| novel_id | FK |
| number | int |
| title | str |
| source_text | text |
| translated | bool |
| word_count | int |

### Segments
| Field | Type |
|-------|------|
| id | UUID |
| chapter_id | FK |
| segment_number | int |
| source_text | text |
| translation | text |
| status | enum (untouched/translating/translated/needs_review) |
| has_qa | bool |

### Characters
| Field | Type |
|-------|------|
| id | UUID |
| novel_id | FK |
| name | str |
| name_variants | JSON |
| gender | enum |
| role | enum |
| status | enum (Alive/Dead/Missing/Unknown) |
| state_summary | text |
| traits | JSON |

### Glossary
| Field | Type |
|-------|------|
| id | UUID |
| novel_id | FK |
| source_term | str |
| target_term | str |
| category | enum |
| is_name | bool |
| context_note | text |

### QA Queue
| Field | Type |
|-------|------|
| id | UUID |
| segment_id | FK |
| question_type | str |
| question | text |
| context_snippet | text |
| suggestions | JSON |
| answer | text nullable |
| resolved | bool |

### Settings
| Field | Type |
|-------|------|
| key | str (PK) |
| value | text |

### Translation Memory (ChromaDB)
Stores source_text as document, target_text + novel_id + chapter_id as metadata. Queried by embedding similarity.

---

## 10. Frontend Layout

### Main Workspace
```
┌──────────────┬──────────────────────────────────┬──────────────────┐
│   SIDEBAR    │     MAIN CONTENT                   │   CONTEXT PANEL  │
│              │                                   │   (toggleable)   │
│ OpenTranslator│  ┌────────────────────────────┐  │ Characters       │
│ ─────────────│  │ [Translate Chapter] button  │  │ Glossary         │
│ Chapters     │  │ [Translate] [Review] toggle │  │ Plot Arcs        │
│  ├ Ch.1 ✓    │  └────────────────────────────┘  │                  │
│  ├ Ch.2      │  Source text → Translation        │                  │
│  │           │  or Review list with edit/accept   │                  │
│  [Translate  │                                   │                  │
│   Chapter]   │  [Completion Popup on done]        │                  │
│              │                                   │                  │
└──────────────┴──────────────────────────────────┴──────────────────┘
└────────────────────────── STATUSBAR ─────────────────────────────────┘
   ● Connected  │  Translating (6/12) ████░░  │  Novel · 4 ch · v0.2.0
```

### Views
1. **Project Home** — Project list, create/open/delete with confirmation dialog
2. **Translate Mode** — Shows "Translate Chapter" button with context description
3. **Review Mode** — Scrollable segment list with edit/accept/reset per segment
4. **Characters** — CRUD with edit modal (gender, role, status, variants)
5. **Glossary** — CRUD with search
6. **QA Queue** — Questions with source text + literal translation context
7. **Settings** — LLM providers, batch size slider, language, directory

### Loading Overlay
During backend "connecting" state, a full-screen `backdrop-blur` overlay prevents user interaction. Shows spinner with "Starting OpenTranslator — Connecting to backend server..." or error state with retry button.

---

## 11. StatusBar (Bottom Bar)

28px bar across the full window bottom:

| Section | Content |
|---------|---------|
| Left | ● Connecting/Connected/Error (color-coded dot + text) |
| Center | Activity text + optional progress bar (e.g., translating, importing) |
| Right | Project title · chapters · v0.1.0 |

Progress bar shows during:
- Chapter translation (polled every 2s)
- ChromaDB model download on first startup ("Loading AI model...")

---

## 12. API Endpoints

### Chapter Translation
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chapters/{id}/translate-all` | Translate all segments with batching + QA |
| POST | `/api/chapters/{id}/apply-qa` | Re-translate segments with resolved QA answers |
| POST | `/api/chapters/{id}/reapply` | Clear + re-translate all segments with current context |
| POST | `/api/chapters/{id}/cancel-translation` | Abort in-progress chapter translation |
| GET | `/api/chapters/{id}/translate-progress` | Get live translation progress (batch, status) |
| POST | `/api/chapters/{id}/check-status` | Update chapter translated flag |
| POST | `/api/chapters/{id}/summarize` | Auto-generate plot summary |
| POST | `/translate` | Single segment translate (legacy) |
| PUT | `/api/segments/{id}` | Save segment translation |
| DELETE | `/api/chapters/{id}` | Delete chapter + TM cleanup |

### Projects & Chapters
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/projects` | List/create projects |
| GET/DELETE | `/api/projects/{id}` | Get/delete project |
| GET/PUT | `/api/projects/{id}/instructions` | Project-level translator instructions |
| GET | `/api/projects/{id}/export-proj` | Export full project as .novelproj JSON |
| POST | `/api/projects/import-proj` | Import .novelproj JSON into SQLite |
| GET | `/api/projects/{id}/chapters` | List chapters |
| POST | `/api/chapters/import` | Import chapter (text → segments) |
| GET | `/api/chapters/{id}/segments` | Get segments |

### Context
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/context/{chapter_id}?novel_id=` | Characters, glossary, plot arcs |

### Characters, Glossary, Questions
| Method | Endpoint | Description |
|--------|----------|-------------|
| CRUD | `/api/characters` | Character management (with gender suggestion + transliteration) |
| CRUD | `/api/glossary` | Glossary management |
| GET | `/api/questions` | List QA (includes segment source + translation + transliteration) |
| POST | `/api/questions/{id}/answer-and-retranslate` | Answer + re-translate |
| POST | `/api/questions/batch-answer` | Batch-answer all questions of a type |
| POST | `/api/questions/batch-dismiss` | Dismiss all questions of a type |
| POST | `/api/questions/batch-answer-and-classify` | Batch answer Name-type + auto-classify |

### Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/PUT | `/api/settings` | Read/write settings with meta |
| GET | `/api/settings/llm-config` | Provider config for pipeline |
| GET | `/api/settings/models?provider=` | Fetch model list from provider API |
| GET | `/api/init/status` | ChromaDB init status |

### Export
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/export` | Export as HTML, plaintext, or markdown |

---

## 13. Settings

### Stored in SQLite `settings` table (key-value)
- `primary_provider`, `primary_model`, `primary_base_url`, `primary_api_key`
- `fallback_provider`, `fallback_model`, `fallback_base_url`, `fallback_api_key`
- `default_source_lang`, `default_target_lang`
- `default_project_dir` — Default save location for projects
- `batch_size` — Segments per LLM call (slider 1-10, default 4)
- `llm_timeout` — Max seconds to wait for LLM response (range 10-300, default 60)

### LLM Provider Model Fetching
`GET /api/settings/models?provider=xxx&api_key=yyy` fetches available models:
- OpenAI-compatible: `GET {base}/v1/models` → `{data: [{id, ...}]}`
- Ollama: `GET {base}/api/tags` → `{models: [{name, ...}]}`
- Google Gemini: `GET {base}/v1beta/models` → `{models: [{name, ...}]}`
- Anthropic: `GET {base}/v1/models` with `x-api-key` header
- Graceful fallback if endpoint returns non-JSON or errors

---

## 14. Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Electron (spawns Python + health check) |
| Frontend | React 18 + TypeScript |
| State | Zustand |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Backend | Python 3.11+ / FastAPI |
| Database | SQLite + SQLAlchemy (async) |
| Vector Store | ChromaDB (lazy init, onnxruntime suppression) |
| LLM Router | LiteLLM with custom provider config |
| Migrations | Alembic (auto-generated) |
| Packaging | electron-builder (NSIS, DMG, AppImage) |

---

## 15. Key Python Dependencies

```
fastapi, uvicorn, sqlalchemy[asyncio], aiosqlite
chromadb (lazy init, ONNX warnings suppressed)
litellm, openai, httpx
langdetect, jieba
pydantic, pydantic-settings
alembic
python-multipart
```

---

## 16. Key Technical Decisions

| Challenge | Solution |
|-----------|----------|
| **Slow translation (N LLM calls)** | Batch 4 segments per call with `[SEG N]` delimiter parsing |
| **Context across segments** | Sliding window: 3 previous + 3 upcoming segments |
| **CORS between renderer & backend** | IPC bridge (`electronAPI.fetch` → main process → Node fetch) |
| **Settings reset on restart** | SQLite `settings` table, loaded into cache at startup |
| **settings cache empty** | `load_cache()` called in `main.py` startup event |
| **Model stays empty** | `DEFAULT_MODELS` per provider in `providers.py` |
| **ONNX CUDA/TensorRT warnings** | `onnxruntime.set_default_logger_severity(4)` |
| **Backend not ready on app start** | Health check polling, loading overlay, status bar |
| **Tab switching loses translation** | Zustand store (not local useState) for translation state |
| **Large provider list** | 15 providers with correct base URLs + model fetch endpoint |
| **Different API formats** | Provider-specific model endpoint URLs (Ollama `/api/tags`, etc.) |
| **QA answers not applied** | "Apply QA Answers" button re-translates affected segments |
| **Portable projects** | SQLite database file per project |

---

## 17. Startup Flow

1. Electron starts → spawns Python backend as child process with env vars
2. Python backend starts FastAPI server on port 8712
3. `startup` event: create DB tables, load settings cache, trigger ChromaDB init
4. Electron pings `/health` every 500ms (up to 15s) until connected
5. Frontend shows **LoadingOverlay** (blur + spinner) during "connecting" state
6. Once connected → status bar turns green + "Connected" + ChromaDB loads model
7. User can now create projects, import chapters, and translate

### Error handling on startup failure
- Python not found → Electron catches spawn error → sends to renderer
- Backend crashes after start → health check detects → shows error in status bar + overlay
- ChromaDB model download → background init with `/init/status` polling

---

## 18. Project Creation Flow

1. User clicks "New Project" → modal with title, languages, genre
2. Optional: "Save to custom location" checkbox + folder picker
3. Default save location from Settings (Default Project Directory)
4. Backend creates Novel + returns ID
5. Frontend navigates to TranslateView with novel ID
6. User imports chapters (text file via Electron dialog)
7. Auto-detection: Chinese names in content are added as characters

### Delete Project
- Trash icon → confirmation dialog showing project name + warning
- "This action cannot be undone. All chapters, characters, and glossary terms will be permanently removed."

---

## 19. Development Commands

```bash
# Development
npm run dev                  # Frontend + backend (electron spawns Python)
npm run backend:dev          # Backend only (cd backend && uvicorn ... --reload)

# Production build
npm run build                # electron-vite build
npm run dist:win             # electron-builder --win (NSIS installer)

# Database migrations
python -m alembic revision --autogenerate -m "description"
python -m alembic upgrade head

# Type checking
npm run lint                 # tsc --noEmit
```
