import hashlib
import math
import uuid as _uuid
from datetime import date, datetime

from explain_analytics.config import settings
from explain_analytics.models import DocumentReference, RagIngestDocument

_MIN_RELEVANCE_SCORE = 0.55
_SPARSE_VECTOR_NAME = "bm25"
_DENSE_VECTOR_NAME = "dense"


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
    """
    Hybrid retrieval over the MoH dengue document corpus stored in Qdrant.

    Each document is indexed with two vectors:
    - dense:  Google text-embedding-004 (768-dim) for semantic similarity
    - bm25:   fastembed BM25 sparse vectors for exact keyword matching

    Retrieval combines both via Qdrant's native RRF (Reciprocal Rank Fusion),
    falling back to dense-only or sparse-only when configured.
    """

    def __init__(self) -> None:
        self._ready = False
        self._client = None
        self._sparse_model = None
        if settings.qdrant_url and settings.rag_enabled:
            try:
                from qdrant_client import QdrantClient

                self._client = QdrantClient(url=settings.qdrant_url)
                self._load_sparse_model()
                self._ensure_collection()
                self._ready = True
            except Exception as exc:
                print(f"[RAGService] init failed: {exc}")

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
            mode = settings.rag_retrieval_mode
            if mode == "dense":
                results = self._dense_search(self._embed_dense(query), k)
            elif mode == "sparse":
                results = self._sparse_search(self._embed_sparse(query), k)
            else:
                results = self._hybrid_search(query, k)
            return self._apply_recency_decay(results)
        except Exception as exc:
            print(f"[RAGService] retrieve failed: {exc}")
            return []

    def ingest(self, documents: list[RagIngestDocument]) -> int:
        """Embed and upsert documents into Qdrant with both dense and sparse vectors."""
        from qdrant_client import QdrantClient
        from qdrant_client.models import PointStruct

        if not settings.qdrant_url:
            raise RuntimeError(
                "EXPLAIN_QDRANT_URL is not set. "
                "Configure it in .env before ingesting documents."
            )

        client = self._client or QdrantClient(url=settings.qdrant_url)
        sparse_model = self._sparse_model or self._load_sparse_model(return_model=True)
        self._ensure_collection(client)

        stored = 0
        try:
            for doc in documents:
                dense_vec = self._embed_dense(doc.content)
                sparse_vec = self._embed_sparse(doc.content, model=sparse_model)
                point = PointStruct(
                    id=_point_id(doc.title, doc.source, doc.published_date),
                    vector={
                        _DENSE_VECTOR_NAME: dense_vec,
                        _SPARSE_VECTOR_NAME: sparse_vec,
                    },
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

    # ── Collection setup ────────────────────────────────────────────

    def _ensure_collection(self, client=None) -> None:
        from qdrant_client.models import (
            Distance,
            SparseIndexParams,
            SparseVectorParams,
            VectorParams,
        )

        c = client or self._client
        if c is None:
            return
        try:
            existing = {col.name for col in c.get_collections().collections}
            if settings.qdrant_collection not in existing:
                c.create_collection(
                    collection_name=settings.qdrant_collection,
                    vectors_config={
                        _DENSE_VECTOR_NAME: VectorParams(size=768, distance=Distance.COSINE),
                    },
                    sparse_vectors_config={
                        _SPARSE_VECTOR_NAME: SparseVectorParams(
                            index=SparseIndexParams(on_disk=False)
                        ),
                    },
                )
        except Exception as exc:
            print(f"[RAGService] Could not ensure collection: {exc}")
            self._ready = False

    # ── Embedding ───────────────────────────────────────────────────

    def _load_sparse_model(self, return_model: bool = False):
        from fastembed import SparseTextEmbedding

        model = SparseTextEmbedding(model_name="Qdrant/bm25")
        self._sparse_model = model
        if return_model:
            return model

    def _embed_dense(self, text: str) -> list[float]:
        """768-dimensional dense embedding via Google text-embedding-004."""
        from google import genai

        client = genai.Client(api_key=settings.gemini_api_key)
        result = client.models.embed_content(
            model=settings.rag_embedding_model,
            contents=text,
        )
        return list(result.embeddings[0].values)

    def _embed_sparse(self, text: str, model=None):
        """BM25 sparse embedding via fastembed, returned as a Qdrant SparseVector."""
        from qdrant_client.models import SparseVector

        m = model or self._sparse_model
        result = list(m.embed([text]))[0]
        return SparseVector(
            indices=result.indices.tolist(),
            values=result.values.tolist(),
        )

    # ── Search strategies ───────────────────────────────────────────

    def _hybrid_search(self, query: str, top_k: int) -> list[DocumentReference]:
        """RRF fusion of dense and sparse search via Qdrant's native query API."""
        from qdrant_client.models import FusionQuery, Prefetch, SparseVector

        dense_vec = self._embed_dense(query)
        sparse_vec = self._embed_sparse(query)

        results = self._client.query_points(
            collection_name=settings.qdrant_collection,
            prefetch=[
                Prefetch(
                    query=dense_vec,
                    using=_DENSE_VECTOR_NAME,
                    limit=top_k * 3,
                ),
                Prefetch(
                    query=sparse_vec,
                    using=_SPARSE_VECTOR_NAME,
                    limit=top_k * 3,
                ),
            ],
            query=FusionQuery(fusion="rrf"),
            limit=top_k,
            with_payload=True,
        ).points

        return [
            DocumentReference(
                title=r.payload["title"],
                source=r.payload["source"],
                published_date=r.payload.get("published_date"),
                excerpt=r.payload["content"][:600],
                relevance_score=round(float(r.score), 3),
            )
            for r in results
            if r.score >= _MIN_RELEVANCE_SCORE
        ]

    def _dense_search(self, embedding: list[float], top_k: int) -> list[DocumentReference]:
        results = self._client.search(
            collection_name=settings.qdrant_collection,
            query_vector=(f"{_DENSE_VECTOR_NAME}", embedding),
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

    def _sparse_search(self, sparse_vec, top_k: int) -> list[DocumentReference]:
        from qdrant_client.models import NamedSparseVector

        results = self._client.search(
            collection_name=settings.qdrant_collection,
            query_vector=NamedSparseVector(name=_SPARSE_VECTOR_NAME, vector=sparse_vec),
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

    # ── Recency decay ───────────────────────────────────────────────

    def _apply_recency_decay(
        self, docs: list[DocumentReference]
    ) -> list[DocumentReference]:
        """Re-score documents with a time-decay factor: score × e^(-λ × days_since_published).

        Documents without a published_date are returned unchanged.
        Results are re-sorted by decayed score and re-filtered by _MIN_RELEVANCE_SCORE.
        """
        lam = settings.rag_recency_decay_lambda
        if lam == 0:
            return docs

        today = date.today()
        decayed: list[tuple[float, DocumentReference]] = []
        for doc in docs:
            raw = doc.relevance_score if doc.relevance_score is not None else 1.0
            if doc.published_date:
                try:
                    pub = datetime.strptime(doc.published_date, "%Y-%m-%d").date()
                    days = (today - pub).days
                    adjusted = raw * math.exp(-lam * max(days, 0))
                except ValueError:
                    adjusted = raw
            else:
                adjusted = raw
            decayed.append((adjusted, doc))

        decayed.sort(key=lambda x: x[0], reverse=True)
        return [
            DocumentReference(
                title=d.title,
                source=d.source,
                published_date=d.published_date,
                excerpt=d.excerpt,
                relevance_score=round(score, 3),
            )
            for score, d in decayed
            if score >= _MIN_RELEVANCE_SCORE
        ]

    # ── Query construction ──────────────────────────────────────────

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
