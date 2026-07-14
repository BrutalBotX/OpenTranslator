# OpenTranslator

**AI-powered webnovel translation workstation** — batch-translate Chinese, Japanese, and Korean webnovels into English with persistent character and glossary management.

![version](https://img.shields.io/badge/version-0.6.6-blue)
![electron](https://img.shields.io/badge/electron-31.3-blue)
![python](https://img.shields.io/badge/python-3.11%2B-green)
![license](https://img.shields.io/badge/license-MIT-green)

---

## Features

- **15+ LLM providers** — Ollama (local), OpenAI, Anthropic, DeepSeek, Google Gemini, Groq, Mistral, Together, Perplexity, Cohere, OpenCode, xAI, OpenRouter, Fireworks, DeepInfra, custom endpoints
- **Batch translation** — translate entire chapters at once with configurable batch size (1–10 segments per LLM call)
- **Sliding window context** — each batch sees 3 previous + 3 upcoming segments for coherent flow
- **Persistent character management** — auto-detect characters on import; alias tracking; gender/role/status fields
- **Glossary** — ensure consistent terminology across chapters (cultivation terms, place names, techniques)
- **QA Queue** — ambiguity detection flags pronouns, unknown names, idioms, cultural terms without blocking translation; batch-resolve in review phase
- **Translator instructions** — per-project instruction box for name replacements ("Replace Mara Minato with Shinra Minato"), naming conventions ("Keep surname first"), style rules; commands auto-update character aliases
- **Transliteration** — pinyin/romaji display in QA and review panels
- **Translation memory** — ChromaDB vector store finds similar past translations for style consistency
- **Progress tracking** — real-time batch progress, segment count, LLM status during chapter translation; cancel button to abort mid-translation
- **Resume support** — skips already-translated segments when re-translating a chapter
- **Configurable timeout** — per-provider timeout setting (default 60s) prevents stuck translations
- **Export** — plain text and HTML formats
- **Review pane** — inline editing, accept/reset per segment, batch apply QA answers

---

## Installation

### Prebuilt EXE (Windows)

Download the latest installer from the [releases page](https://github.com/BrutalBotX/opentranslator/releases) or build directly.


**Prerequisites**: [Python 3.11+](https://www.python.org/downloads/) with pip installed and on PATH. Run `pip install -r requirements.txt` after installing Python.

> See [CHANGELOG.md](CHANGELOG.md) for the full release history.

### From source

```bash
git clone https://github.com/your-org/opentranslator.git
cd opentranslator

# Install Python dependencies
pip install -r requirements.txt

# Install Node.js dependencies
npm install

# Start development mode
npm run dev
```

---

## Quick Start

1. **Launch** — OpenTranslator starts a Python backend (FastAPI on port 8712) automatically via Electron
2. **Create a project** — Click "New Project", set source/target language and genre
3. **Import a chapter** — Click the Import button, select a `.txt` file (one paragraph per line = one segment)
4. **Add characters & glossary** — Populate the Characters and Glossary tabs (or let the system auto-detect on import)
5. **Set instructions** — Open the right panel, expand "Instructions", add name overrides or style rules
6. **Translate** — Select the chapter and click "Translate" — the status bar shows batch-by-batch progress
7. **Review** — After translation, switch to Review mode to edit, accept, or reset individual segments
8. **QA Queue** — The QA Queue tab shows flagged items (pronouns, unknown names, cultural terms). Batch-resolve by type

---

## Configuration

### Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Primary Provider | Main LLM provider | ollama |
| Primary Model | Model name for primary provider | llama3:70b |
| Fallback Provider | Backup provider if primary fails | (none) |
| Segments per LLM call | Batch size (1–10) | 4 |
| LLM Timeout | Max seconds per LLM call | 60 |
| Source Language | Novel source language | zh |
| Target Language | Translation target | en |

### Provider Setup

**Ollama (local, free):**
```bash
ollama pull llama3:70b
```

**OpenAI / Anthropic / etc.:**
Set the API key and model name in Settings. Provider-specific base URLs are preconfigured.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Electron Shell                                 │
│  ┌───────────────────────────────────────────┐  │
│  │  Renderer (React + TypeScript)            │  │
│  │  ┌─────────┐ ┌──────────┐ ┌───────────┐  │  │
│  │  │Translate│ │Review    │ │ QA Queue  │  │  │
│  │  │ View    │ │Pane      │ │ Panel     │  │  │
│  │  └────┬────┘ └────┬─────┘ └─────┬─────┘  │  │
│  │       │           │             │         │  │
│  │  ┌────▼───────────▼─────────────▼─────┐   │  │
│  │  │  IPC Bridge (electron/ipc/)        │   │  │
│  │  │  http:fetch → Node fetch()         │   │  │
│  │  └────────────────┬───────────────────┘   │  │
│  └───────────────────┼───────────────────────┘  │
└──────────────────────┼──────────────────────────┘
                       │ HTTP :8712
┌──────────────────────▼──────────────────────────┐
│  FastAPI Backend (Python 3.11+)                  │
│  ┌──────────┐ ┌───────────┐ ┌────────────────┐  │
│  │Router    │ │Pipeline   │ │Ambiguity       │  │
│  │(api/)    │→│(pipeline/)│→│Detector        │  │
│  └──────────┘ └───────────┘ └────────────────┘  │
│       │              │              │            │
│  ┌────▼──────────────▼──────────────▼─────┐      │
│  │  LLMRouter → litellm → Provider API    │      │
│  └────────────────────────────────────────┘      │
│       │              │                           │
│  ┌────▼──────────────▼──────┐                    │
│  │  SQLite (SQLAlchemy)    │  ChromaDB (Vector) │
│  │  - novels, chapters     │  - translation     │
│  │  - segments, characters │    memory          │
│  │  - glossary, plot arcs  │                    │
│  │  - QA items, settings   │                    │
│  └─────────────────────────┘                    │
└─────────────────────────────────────────────────┘
```

### Key directories

```
opentranslator/
├── backend/
│   ├── api/           # FastAPI route handlers
│   ├── db/            # SQLAlchemy models, ChromaDB
│   ├── detectors/     # Language-specific rule engines (zh/ja/ko)
│   ├── llm/           # LiteLLM router, prompts, provider config
│   ├── pipeline/      # Translation pipeline (context, translate, post-process)
│   └── utils/         # Transliteration, instructions parser, character detection
├── electron/
│   ├── ipc/           # IPC handlers (http:fetch proxy)
│   └── main/          # Electron main process (backend spawn, window)
├── src/renderer/      # React frontend
│   ├── components/    # UI components (ChapterNav, ContextPanel, etc.)
│   ├── layouts/       # App layout (WorkspaceLayout)
│   ├── pages/         # Route pages (TranslateView, QAPanel, Settings, etc.)
│   ├── services/      # API client (IPC bridge)
│   └── stores/        # Zustand state stores
└── package.json       # Electron + React dependencies
```

---

## Development

```bash
# Install everything
pip install -r requirements.txt
npm install

# Run in dev mode (hot reload frontend + backend)
npm run dev

# Backend only (for testing API directly)
npm run backend:dev

# Lint TypeScript
npm run lint

# Build production EXE
npm run dist:win
```

### Adding a new LLM provider

1. Add the provider name, base URL, label, and pricing to `backend/api/settings.py`
2. Add the default model to `DEFAULT_MODELS` in `backend/llm/providers.py`
3. Add model fetch logic to the `/settings/models` endpoint if the provider has a `/models` API

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron 31 |
| Frontend | React 18, TypeScript, Tailwind CSS, Zustand |
| Backend | Python 3.11+, FastAPI, Uvicorn |
| Database | SQLite (SQLAlchemy 2.0 async) |
| Vector store | ChromaDB |
| LLM routing | LiteLLM |
| Translation | ChineseDetector, JapaneseDetector, KoreanDetector (regex-based ambiguity) |
| Unicode | pypinyin (Chinese romanization) |

---

## License

MIT
