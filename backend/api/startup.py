import asyncio
from fastapi import APIRouter

router = APIRouter()

_init_status = {"chromadb": "pending", "error": None}


def trigger_chromadb_init():
    """Called from main.py startup to begin background init."""
    asyncio.create_task(_init_chromadb())


async def _init_chromadb():
    global _init_status
    _init_status["chromadb"] = "loading"
    try:
        from backend.db.vector_store import _get_collection
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _get_collection)
        _init_status["chromadb"] = "ready"
    except Exception as e:
        _init_status["chromadb"] = "error"
        _init_status["error"] = str(e)


@router.get("/init/status")
async def get_init_status():
    return _init_status
