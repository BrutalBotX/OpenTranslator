import os
os.environ["ORT_LOGGING_LEVEL"] = "4"  # 4 = FATAL only
os.environ["ORT_TENSORRT_DISABLE"] = "1"
os.environ["CUDA_VISIBLE_DEVICES"] = "-1"

import logging
logging.getLogger("onnxruntime").setLevel(logging.ERROR)

import warnings
warnings.filterwarnings("ignore", category=UserWarning, module="onnxruntime")
try:
    import onnxruntime
    onnxruntime.set_default_logger_severity(4)
except Exception:
    pass

import chromadb
from chromadb.config import Settings as ChromaSettings
from chromadb.utils import embedding_functions

from backend.config import settings

import threading

_client_lock = threading.Lock()
_collection_lock = threading.Lock()
_client = None
_tm_collection = None
_ef = None


def _get_client():
    global _client
    if _client is None:
        with _client_lock:
            if _client is None:
                _client = chromadb.PersistentClient(
                    path=settings.chroma_persist_dir,
                    settings=ChromaSettings(anonymized_telemetry=False)
                )
    return _client


def _get_collection():
    global _tm_collection, _ef
    if _tm_collection is not None:
        return _tm_collection
    with _collection_lock:
        if _tm_collection is not None:
            return _tm_collection
        client = _get_client()
        try:
            import onnxruntime
            onnxruntime.set_default_logger_severity(4)
        except Exception:
            pass
        if _ef is None:
            _ef = embedding_functions.DefaultEmbeddingFunction()
        _tm_collection = client.get_or_create_collection("translation_memory", embedding_function=_ef)
        return _tm_collection


def search_similar(source_text: str, novel_id: str, n_results: int = 5) -> list[dict]:
    try:
        collection = _get_collection()
        results = collection.query(
            query_texts=[source_text],
            n_results=n_results,
            where={"novel_id": novel_id},
        )
        items = []
        metas = (results.get("metadatas") or [None])[0]
        dists = (results.get("distances") or [None])[0]
        if metas:
            for i, meta in enumerate(metas):
                if not meta:
                    continue
                items.append({
                    "source_text": meta.get("source_text", ""),
                    "target_text": meta.get("target_text", ""),
                    "chapter_id": meta.get("chapter_id", ""),
                    "distance": dists[i] if dists and i < len(dists) else 0,
                })
        return items
    except Exception as e:
        print(f"[TM] Search error: {e}")
        return []


def add_to_tm(segment_id: str, source_text: str, target_text: str, novel_id: str, chapter_id: str):
    try:
        collection = _get_collection()
        collection.upsert(
            documents=[source_text],
            metadatas=[{
                "id": segment_id,
                "source_text": source_text,
                "target_text": target_text,
                "novel_id": novel_id,
                "chapter_id": chapter_id,
            }],
            ids=[segment_id],
        )
    except Exception as e:
        print(f"[TM] Upsert error: {e}")
