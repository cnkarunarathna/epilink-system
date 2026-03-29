import hashlib
import uuid as _uuid

from explain_analytics.config import settings
from explain_analytics.models import DocumentReference, RagIngestDocument

_MIN_RELEVANCE_SCORE = 0.55


def _risk_label(score: float) -> str:
    if score >= 0.85:
        return "critical"
    if score >= 0.65:
        return "high"
    if score >= 0.40:
        return "moderate"
    return "low"


def _point_id(title: str, source: str, published_date: str | None) -> str:
    """Deterministic UUID derived from document identity for idempotent upserts."""
    key = f"{title}|{source}|{published_date or ''}"
    return str(_uuid.UUID(hashlib.md5(key.encode()).hexdigest()))


class RAGService:
    """Semantic retrieval over the MoH dengue document corpus stored in Qdrant."""

    def __init__(self) -> None:
        self._ready = False
        self._client = None
        if settings.qdrant_url and settings.rag_enabled:
            try:
                from qdrant_client import QdrantClient

                self._client = QdrantClient(url=settings.qdrant_url)
                self._ensure_collection()
                self._ready = True
            except Exception as exc:
                print(f"[RAGService] Qdrant init failed: {exc}")

    @property
    def is_ready(self) -> bool:
        return self._ready

    def retrieve(
        self,
        district: str,
        model_risk_score: float,
        rainfall_mm_7d: float | None = None,
        temperature_c_7d: float | None = None,
        wow_case_change_pct: float | None = None,
        top_k: int | None = None,
    ) -> list[DocumentReference]:
        """Return the top-K most relevant documents for the given district signals."""
        if not self._ready:
            return []

        k = top_k or settings.rag_top_k
        query = self._build_query(
            district, model_risk_score, rainfall_mm_7d, temperature_c_7d, wow_case_change_pct
        )
        try:
            embedding = self._embed(query)
            return self._vector_search(embedding, k)
        except Exception as exc:
            print(f"[RAGService] retrieve failed: {exc}")
            return []

    def ingest(self, documents: list[RagIngestDocument]) -> int:
        """Embed and upsert documents into Qdrant. Returns count of stored documents."""
        from qdrant_client import QdrantClient
        from qdrant_client.models import PointStruct

        if not settings.qdrant_url:
            raise RuntimeError(
                "EXPLAIN_QDRANT_URL is not set. "
                "Configure it in .env before ingesting documents."
            )

        client = self._client or QdrantClient(url=settings.qdrant_url)
        self._ensure_collection(client)

        stored = 0
        try:
            for doc in documents:
                embedding = self._embed(doc.content)
                point = PointStruct(
                    id=_point_id(doc.title, doc.source, doc.published_date),
                    vector=embedding,
                    payload={
                        "title": doc.title,
                        "source": doc.source,
                        "published_date": doc.published_date,
                        "content": doc.content,
                        "source_type": "guideline",
                    },
                )
                client.upsert(
                    collection_name=settings.qdrant_collection,
                    points=[point],
                )
                stored += 1
        except Exception as exc:
            raise RuntimeError(f"Ingestion failed after {stored} document(s): {exc}") from exc
        return stored

    def document_count(self) -> int:
        """Return the total number of points in the Qdrant collection."""
        if not self._ready or self._client is None:
            return 0
        try:
            info = self._client.get_collection(settings.qdrant_collection)
            return info.points_count or 0
        except Exception:
            return 0

    def _ensure_collection(self, client=None) -> None:
        from qdrant_client.models import Distance, VectorParams

        c = client or self._client
        if c is None:
            return
        try:
            existing = {col.name for col in c.get_collections().collections}
            if settings.qdrant_collection not in existing:
                c.create_collection(
                    collection_name=settings.qdrant_collection,
                    vectors_config=VectorParams(size=768, distance=Distance.COSINE),
                )
        except Exception as exc:
            print(f"[RAGService] Could not ensure collection: {exc}")
            self._ready = False

    def _embed(self, text: str) -> list[float]:
        """Generate a 768-dimensional embedding using Google text-embedding-004."""
        from google import genai

        client = genai.Client(api_key=settings.gemini_api_key)
        result = client.models.embed_content(
            model=settings.rag_embedding_model,
            contents=text,
        )
        return list(result.embeddings[0].values)

    def _build_query(
        self,
        district: str,
        model_risk_score: float,
        rainfall_mm_7d: float | None,
        temperature_c_7d: float | None,
        wow_case_change_pct: float | None,
    ) -> str:
        """Construct a natural-language retrieval query from district signals."""
        risk = _risk_label(model_risk_score)
        parts = [f"dengue {risk} risk {district} district Sri Lanka intervention response"]

        if rainfall_mm_7d is not None and rainfall_mm_7d >= 80:
            parts.append("heavy rainfall standing water Aedes breeding site elimination")
        if temperature_c_7d is not None and temperature_c_7d >= 28:
            parts.append("high temperature vector control mosquito lifecycle acceleration")
        if wow_case_change_pct is not None and wow_case_change_pct >= 15:
            parts.append("rapid case surge outbreak early warning emergency response protocol")
        if risk in ("high", "critical"):
            parts.append("fogging fumigation rapid response team hospital preparedness")

        return " ".join(parts)

    def _vector_search(self, embedding: list[float], top_k: int) -> list[DocumentReference]:
        results = self._client.search(
            collection_name=settings.qdrant_collection,
            query_vector=embedding,
            limit=top_k,
            score_threshold=_MIN_RELEVANCE_SCORE,
            with_payload=True,
        )
        return [
            DocumentReference(
                title=r.payload["title"],
                source=r.payload["source"],
                published_date=r.payload.get("published_date"),
                excerpt=r.payload["content"][:600],
                relevance_score=round(float(r.score), 3),
            )
            for r in results
        ]
