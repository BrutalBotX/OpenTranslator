import os
os.environ["ORT_LOGGING_LEVEL"] = "3"
os.environ["ORT_TENSORRT_DISABLE"] = "1"

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api import translate, context, characters, glossary, questions, export, projects, settings
from backend.api import startup as startup_api
from backend.api.settings import load_cache
from backend.api.startup import trigger_chromadb_init
from backend.db.database import engine, Base

app = FastAPI(title="OpenTranslator Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        def run_migrations(sync_conn):
            import sqlite3
            cursor = sync_conn.connection.cursor()
            cursor.execute("PRAGMA table_info(novels)")
            cols = {row[1] for row in cursor.fetchall()}
            if "instructions" not in cols:
                cursor.execute("ALTER TABLE novels ADD COLUMN instructions TEXT DEFAULT ''")
                print("[migration] Added 'instructions' column to novels table")

        await conn.run_sync(run_migrations)

    try:
        await load_cache()
    except Exception as e:
        print(f"[startup] Failed to load settings cache: {e}")
    try:
        trigger_chromadb_init()
    except Exception as e:
        print(f"[startup] Failed to start ChromaDB init: {e}")

@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}

app.include_router(translate.router, prefix="/api")
app.include_router(context.router, prefix="/api")
app.include_router(characters.router, prefix="/api")
app.include_router(glossary.router, prefix="/api")
app.include_router(questions.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(startup_api.router, prefix="/api")
