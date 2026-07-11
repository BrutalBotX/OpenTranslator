import os
os.environ["ORT_LOGGING_LEVEL"] = "3"
os.environ["ORT_TENSORRT_DISABLE"] = "1"

# Suppress onnxruntime C-level warnings by setting severity to FATAL
import warnings
warnings.filterwarnings("ignore", category=UserWarning, module="onnxruntime")
try:
    import onnxruntime
    onnxruntime.set_default_logger_severity(4)  # 4 = FATAL only
except Exception:
    pass

try:
    import chromadb
    from chromadb.config import Settings as ChromaSettings
    from chromadb.utils import embedding_functions
finally:
    pass

from backend.config import settings

_client = None
_tm_collection = None
_ef = None


def _get_client():
    global _client
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
    client = _get_client()
    try:
        import onnxruntime
        onnxruntime.set_default_logger_severity(4)
    except Exception:
        pass
    if _ef is None:
        _ef = embedding_functions.DefaultEmbeddingFunction()
    try:
        _tm_collection = client.get_collection("translation_memory")
    except Exception:
        try:
            client.delete_collection("translation_memory")
        except Exception:
            pass
        _tm_collection = client.create_collection("translation_memory", embedding_function=_ef)
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
        if results["metadatas"] and results["metadatas"][0]:
            for i, meta in enumerate(results["metadatas"][0]):
                items.append({
                    "source_text": meta.get("source_text", ""),
                    "target_text": meta.get("target_text", ""),
                    "chapter_id": meta.get("chapter_id", ""),
                    "distance": results["distances"][0][i] if results["distances"] else 0,
                })
        return items
    except Exception as e:
        print(f"[TM] Search error: {e}")
        return []


def add_to_tm(segment_id: str, source_text: str, target_text: str, novel_id: str, chapter_id: str):
    try:
        collection = _get_collection()
        collection.add(
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
        print(f"[TM] Add error: {e}")
