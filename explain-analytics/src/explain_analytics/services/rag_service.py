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
        feature_importances: dict[str, float] | None = None,
    ) -> list[DocumentReference]:
        """Return the top-K most relevant documents for the given district signals."""
        if not self._ready:
            return []

        # Fetch more candidates when re-ranking will cull them down afterwards
        k = (settings.rag_rerank_candidate_k if settings.rag_rerank_enabled
             else (top_k or settings.rag_top_k))
        query = self._build_query(
            district, model_risk_score, rainfall_mm_7d, temperature_c_7d,
            wow_case_change_pct, feature_importances=feature_importances,
        )
        # High/critical risk: prefer live surveillance data; lower risk: search all
        risk = _risk_label(model_risk_score)
        preferred_source = "surveillance" if risk in ("high", "critical") else None
        try:
            if preferred_source:
                results = self._filtered_hybrid_search(query, k, preferred_source)
                # Fall back to unfiltered when surveillance corpus returns too few docs
                if len(results) < 2:
                    results = self._hybrid_search(query, k)
            elif settings.rag_retrieval_mode == "dense":
                results = self._dense_search(self._embed_dense(query), k)
            elif settings.rag_retrieval_mode == "sparse":
                results = self._sparse_search(self._embed_sparse(query), k)
            else:
                results = self._hybrid_search(query, k)
            decayed = self._apply_recency_decay(results)
            if settings.rag_rerank_enabled and len(decayed) > settings.rag_rerank_top_n:
                return self._rerank_with_gemini(query, decayed, settings.rag_rerank_top_n)
            return decayed
        except Exception as exc:
            print(f"[RAGService] retrieve failed: {exc}")
            return []

    def retrieve_for_query(
        self,
        query: str,
        top_k: int | None = None,
        source_type: str | None = None,
    ) -> list[DocumentReference]:
        """Retrieve documents using a direct natural-language query.

        Unlike retrieve(), this method does not construct the query from
        structured signals — it takes the raw query string directly. This
        is used by the chat agent to answer general dengue knowledge questions.

        Args:
            query: Natural-language question or keyword phrase.
            top_k: Maximum results to return; defaults to settings.rag_top_k.
            source_type: Optional payload filter ('guideline', 'surveillance',
                         'report', 'knowledge'). When None, all types are searched.
        """
        if not self._ready:
            return []

        # Fetch more candidates when re-ranking will cull them down afterwards
        k = (settings.rag_rerank_candidate_k if settings.rag_rerank_enabled
             else (top_k or settings.rag_top_k))
        # Explicit caller-supplied type takes priority; otherwise infer from query text
        effective_source_type = source_type or self._infer_query_intent(query)
        try:
            mode = settings.rag_retrieval_mode
            if effective_source_type:
                results = self._filtered_hybrid_search(query, k, effective_source_type)
                # Fall back to unfiltered search when the filtered set is too small
                if not results:
                    results = self._hybrid_search(query, k)
            elif mode == "dense":
                results = self._dense_search(self._embed_dense(query), k)
            elif mode == "sparse":
                results = self._sparse_search(self._embed_sparse(query), k)
            else:
                results = self._hybrid_search(query, k)
            decayed = self._apply_recency_decay(results)
            if settings.rag_rerank_enabled and len(decayed) > settings.rag_rerank_top_n:
                return self._rerank_with_gemini(query, decayed, settings.rag_rerank_top_n)
            return decayed
        except Exception as exc:
            print(f"[RAGService] retrieve_for_query failed: {exc}")
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

    def ingest_with_source_type(self, documents: list[RagIngestDocument], source_type: str) -> int:
        """Embed and upsert documents tagged with a specific source_type payload."""
        from qdrant_client import QdrantClient
        from qdrant_client.models import PointStruct

        if not settings.qdrant_url:
            raise RuntimeError("EXPLAIN_QDRANT_URL is not set.")

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
                        "content_preview": doc.content[:300],
                        "source_type": source_type,
                    },
                )
                client.upsert(collection_name=settings.qdrant_collection, points=[point])
                stored += 1
        except Exception as exc:
            raise RuntimeError(f"Ingestion failed after {stored} document(s): {exc}") from exc
        return stored

    def _chunk_text(self, text: str) -> list[str]:
        """Split text into overlapping word-based chunks for finer-grained indexing."""
        words = text.split()
        size = settings.rag_chunk_size
        overlap = settings.rag_chunk_overlap
        chunks: list[str] = []
        i = 0
        while i < len(words):
            chunks.append(" ".join(words[i: i + size]))
            i += size - overlap
        return chunks if chunks else [text]

    def ingest_chunked(self, documents: list[RagIngestDocument], source_type: str = "knowledge") -> int:
        """Split each document into overlapping chunks and upsert into Qdrant.

        Each chunk point carries parent_id, chunk_index, and total_chunks in its
        payload so callers can reconstruct the parent document if needed.
        Replaces ingest_with_source_type for the knowledge corpus (Phase 2).
        """
        from qdrant_client import QdrantClient
        from qdrant_client.models import PointStruct

        if not settings.qdrant_url:
            raise RuntimeError("EXPLAIN_QDRANT_URL is not set.")

        client = self._client or QdrantClient(url=settings.qdrant_url)
        sparse_model = self._sparse_model or self._load_sparse_model(return_model=True)
        self._ensure_collection(client)

        stored = 0
        try:
            for doc in documents:
                parent_id = _point_id(doc.title, doc.source, doc.published_date)
                chunks = self._chunk_text(doc.content)
                total = len(chunks)
                for idx, chunk in enumerate(chunks):
                    chunk_id = _point_id(
                        f"{doc.title}_chunk_{idx}", doc.source, doc.published_date
                    )
                    dense_vec = self._embed_dense(chunk)
                    sparse_vec = self._embed_sparse(chunk, model=sparse_model)
                    client.upsert(
                        collection_name=settings.qdrant_collection,
                        points=[PointStruct(
                            id=chunk_id,
                            vector={
                                _DENSE_VECTOR_NAME: dense_vec,
                                _SPARSE_VECTOR_NAME: sparse_vec,
                            },
                            payload={
                                "title": doc.title,
                                "source": doc.source,
                                "published_date": doc.published_date,
                                "content": chunk,
                                "source_type": source_type,
                                "parent_id": parent_id,
                                "chunk_index": idx,
                                "total_chunks": total,
                            },
                        )],
                    )
                    stored += 1
        except Exception as exc:
            raise RuntimeError(f"Chunked ingestion failed after {stored} chunk(s): {exc}") from exc
        return stored

    def record_feedback(self, point_id: str, vote: str) -> None:
        """Persist a user up/down vote on a retrieved document in its Qdrant payload.

        Updates feedback_positive, feedback_negative, and feedback_ratio fields.
        These are picked up by _apply_recency_decay on the next retrieval to amplify
        well-rated documents (ratio→1 gives ×1.2) and penalise poor ones (ratio→0 gives ×0.8).
        Has no effect until the first vote (default ratio=0.5 → neutral multiplier ×1.0).
        """
        if not self._ready or self._client is None:
            return
        try:
            points = self._client.retrieve(
                collection_name=settings.qdrant_collection,
                ids=[point_id],
                with_payload=True,
            )
            if not points:
                return
            payload = points[0].payload or {}
            pos = int(payload.get("feedback_positive", 0))
            neg = int(payload.get("feedback_negative", 0))
            if vote == "up":
                pos += 1
            else:
                neg += 1
            ratio = pos / (pos + neg) if (pos + neg) > 0 else 0.5
            self._client.set_payload(
                collection_name=settings.qdrant_collection,
                payload={
                    "feedback_positive": pos,
                    "feedback_negative": neg,
                    "feedback_ratio": round(ratio, 3),
                },
                points=[point_id],
            )
        except Exception as exc:
            print(f"[RAGService] record_feedback failed: {exc}")

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
        """768-dimensional dense embedding via gemini-embedding-001."""
        from google import genai
        from google.genai import types as _gt

        client = genai.Client(api_key=settings.gemini_api_key)
        result = client.models.embed_content(
            model=settings.rag_embedding_model,
            contents=text,
            config=_gt.EmbedContentConfig(output_dimensionality=768),
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

    # ── HyDE query expansion ────────────────────────────────────────

    _HYDE_PROMPT = (
        "You are a dengue epidemiology expert. Write a 2–3 sentence excerpt from a "
        "Ministry of Health dengue risk management guideline that would be the MOST "
        "relevant document for the following situation. Do not mention the district name. "
        "Write only the guideline text, no preamble.\n\nSituation: {query}"
    )

    def _expand_query_with_hyde(self, query: str) -> str:
        """Generate a hypothetical guideline excerpt and return it as the search query.

        Dense embedding of a document-style hypothesis typically outperforms embedding
        a keyword bag because the vector space was trained on document-like text.
        Falls back to the original query on any error or when Gemini is unavailable.
        """
        if not settings.gemini_api_key:
            return query
        try:
            from google import genai
            client = genai.Client(api_key=settings.gemini_api_key)
            response = client.models.generate_content(
                model=settings.llm_model,
                contents=[{"role": "user", "parts": [{"text": self._HYDE_PROMPT.format(query=query)}]}],
                config={"temperature": 0.1, "max_output_tokens": 150},
            )
            hypothesis = (response.text or "").strip()
            return hypothesis if len(hypothesis) > 30 else query
        except Exception as exc:
            print(f"[RAGService] HyDE expansion failed: {exc}")
            return query

    # ── Search strategies ───────────────────────────────────────────

    def _filtered_hybrid_search(
        self, query: str, top_k: int, source_type: str
    ) -> list[DocumentReference]:
        """RRF hybrid search filtered by source_type payload field."""
        from qdrant_client.models import FieldCondition, Filter, FusionQuery, MatchValue, Prefetch

        dense_query = self._expand_query_with_hyde(query) if settings.rag_hyde_enabled else query
        dense_vec = self._embed_dense(dense_query)
        sparse_vec = self._embed_sparse(query)  # BM25 always uses original keywords
        payload_filter = Filter(
            must=[FieldCondition(key="source_type", match=MatchValue(value=source_type))]
        )

        results = self._client.query_points(
            collection_name=settings.qdrant_collection,
            prefetch=[
                Prefetch(query=dense_vec, using=_DENSE_VECTOR_NAME, limit=top_k * 3, filter=payload_filter),
                Prefetch(query=sparse_vec, using=_SPARSE_VECTOR_NAME, limit=top_k * 3, filter=payload_filter),
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
                excerpt=r.payload["content"],
                relevance_score=round(float(r.score), 3),
                source_type=r.payload.get("source_type"),
                chunk_index=r.payload.get("chunk_index"),
                point_id=str(r.id),
                feedback_ratio=float(r.payload.get("feedback_ratio", 0.5)),
            )
            for r in results
            if r.score >= _MIN_RELEVANCE_SCORE
        ]

    def _hybrid_search(self, query: str, top_k: int) -> list[DocumentReference]:
        """RRF fusion of dense and sparse search via Qdrant's native query API."""
        from qdrant_client.models import FusionQuery, Prefetch, SparseVector

        dense_query = self._expand_query_with_hyde(query) if settings.rag_hyde_enabled else query
        dense_vec = self._embed_dense(dense_query)
        sparse_vec = self._embed_sparse(query)  # BM25 always uses original keywords

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
                excerpt=r.payload["content"],
                relevance_score=round(float(r.score), 3),
                source_type=r.payload.get("source_type"),
                chunk_index=r.payload.get("chunk_index"),
                point_id=str(r.id),
                feedback_ratio=float(r.payload.get("feedback_ratio", 0.5)),
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
                excerpt=r.payload["content"],
                relevance_score=round(float(r.score), 3),
                source_type=r.payload.get("source_type"),
                chunk_index=r.payload.get("chunk_index"),
                point_id=str(r.id),
                feedback_ratio=float(r.payload.get("feedback_ratio", 0.5)),
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
                excerpt=r.payload["content"],
                relevance_score=round(float(r.score), 3),
                source_type=r.payload.get("source_type"),
                chunk_index=r.payload.get("chunk_index"),
                point_id=str(r.id),
                feedback_ratio=float(r.payload.get("feedback_ratio", 0.5)),
            )
            for r in results
        ]

    # ── Recency decay ───────────────────────────────────────────────

    # Per-source decay constants keyed to config attribute names.
    _DECAY_CONFIG_KEY: dict[str, str] = {
        "surveillance": "rag_recency_decay_surveillance",
        "knowledge":    "rag_recency_decay_knowledge",
        "guideline":    "rag_recency_decay_guideline",
    }

    def _apply_recency_decay(
        self, docs: list[DocumentReference]
    ) -> list[DocumentReference]:
        """Re-score documents with a time-decay factor: score × e^(-λ × days_since_published).

        λ is chosen per source_type:
          surveillance → 0.05  (~14-day half-life, case data goes stale fast)
          knowledge    → 0.0001 (~19-year half-life, clinical guidelines stay valid)
          guideline    → 0.0003 (~6-year half-life, MoH policy docs)
          other/None   → rag_recency_decay_lambda (default 0.001)

        Documents without a published_date are returned unchanged.
        Results are re-sorted by decayed score and re-filtered by _MIN_RELEVANCE_SCORE.
        """
        default_lam = settings.rag_recency_decay_lambda
        if default_lam == 0:
            return docs

        today = date.today()
        decayed: list[tuple[float, DocumentReference]] = []
        for doc in docs:
            raw = doc.relevance_score if doc.relevance_score is not None else 1.0
            config_key = self._DECAY_CONFIG_KEY.get(doc.source_type or "")
            lam = getattr(settings, config_key, default_lam) if config_key else default_lam

            if doc.published_date and lam > 0:
                try:
                    pub = datetime.strptime(doc.published_date, "%Y-%m-%d").date()
                    days = max((today - pub).days, 0)
                    adjusted = raw * math.exp(-lam * days)
                except ValueError:
                    adjusted = raw
            else:
                adjusted = raw
            # Feedback multiplier: ratio=0 → ×0.8, ratio=0.5 (neutral) → ×1.0, ratio=1 → ×1.2
            feedback_ratio = getattr(doc, "feedback_ratio", 0.5)
            adjusted *= 0.8 + 0.4 * feedback_ratio
            decayed.append((adjusted, doc))

        decayed.sort(key=lambda x: x[0], reverse=True)
        return [
            DocumentReference(
                title=d.title,
                source=d.source,
                published_date=d.published_date,
                excerpt=d.excerpt,
                relevance_score=round(score, 3),
                source_type=d.source_type,
                chunk_index=d.chunk_index,
                point_id=d.point_id,
                feedback_ratio=d.feedback_ratio,
            )
            for score, d in decayed
            if score >= _MIN_RELEVANCE_SCORE
        ]

    # ── Intent inference ───────────────────────────────────────────

    _CLINICAL_KEYWORDS: frozenset[str] = frozenset([
        "treatment", "fluid", "hospital", "warning signs", "platelet", "clinical",
        "management", "diagnosis", "ns1", "pcr", "lab", "serology", "vaccine",
        "dengvaxia", "symptoms", "dhf", "dss", "shock", "pregnancy",
    ])
    _SURVEILLANCE_KEYWORDS: frozenset[str] = frozenset([
        "cases", "outbreak", "trend", "week", "count", "surge", "wow",
        "district", "report", "notification", "cluster", "spread",
    ])

    def _infer_query_intent(self, query: str) -> str | None:
        """Return 'knowledge', 'surveillance', or None (search all) based on query terms."""
        lower = query.lower()
        clinical_hits = sum(1 for k in self._CLINICAL_KEYWORDS if k in lower)
        surveillance_hits = sum(1 for k in self._SURVEILLANCE_KEYWORDS if k in lower)
        if clinical_hits >= 2 and clinical_hits > surveillance_hits:
            return "knowledge"
        if surveillance_hits >= 2 and surveillance_hits > clinical_hits:
            return "surveillance"
        return None

    # ── Cross-encoder re-ranking ────────────────────────────────────

    _RERANK_PROMPT = (
        "You are a document relevance judge for dengue risk analysis.\n\n"
        "Situation: {context}\n\n"
        "For each document below, output ONLY a JSON array of objects with "
        "\"idx\" (0-based) and \"score\" (0.0–1.0, how useful this document is "
        "for the situation above). No explanation, only valid JSON.\n\n"
        "Documents:\n{docs}"
    )

    def _rerank_with_gemini(
        self,
        query: str,
        docs: list[DocumentReference],
        top_n: int,
    ) -> list[DocumentReference]:
        """Re-score candidates via a Gemini relevance-judge call and return the top-N.

        The prompt sees the full epidemiological context (query) alongside each
        chunk title + excerpt, so it can demote a high-vector-score chunk that is
        actually off-topic for this specific district/risk situation.
        Falls back to the original order on any error.
        """
        import json as _json

        if not docs or not settings.gemini_api_key:
            return docs[:top_n]
        try:
            from google import genai
            doc_block = "\n".join(
                f"[{i}] {d.title}: {d.excerpt[:300]}"
                for i, d in enumerate(docs)
            )
            prompt = self._RERANK_PROMPT.format(context=query, docs=doc_block)
            client = genai.Client(api_key=settings.gemini_api_key)
            response = client.models.generate_content(
                model=settings.llm_model,
                contents=[{"role": "user", "parts": [{"text": prompt}]}],
                config={"response_mime_type": "application/json", "temperature": 0.0},
            )
            scores = _json.loads(response.text or "[]")
            scored: dict[int, float] = {int(item["idx"]): float(item["score"]) for item in scores}
            reranked = sorted(range(len(docs)), key=lambda i: scored.get(i, 0.0), reverse=True)
            return [
                DocumentReference(
                    title=docs[i].title,
                    source=docs[i].source,
                    published_date=docs[i].published_date,
                    excerpt=docs[i].excerpt,
                    relevance_score=round(scored.get(i, docs[i].relevance_score or 0.0), 3),
                    source_type=docs[i].source_type,
                    chunk_index=docs[i].chunk_index,
                    point_id=docs[i].point_id,
                    feedback_ratio=docs[i].feedback_ratio,
                )
                for i in reranked[:top_n]
            ]
        except Exception as exc:
            print(f"[RAGService] re-rank failed: {exc}")
            return docs[:top_n]

    # ── Query construction ──────────────────────────────────────────

    # Maps ML feature names to retrieval-relevant keyword phrases.
    _SHAP_FEATURE_TERMS: dict[str, str] = {
        "rainfall_mm_7d":      "rainfall standing water Aedes breeding site elimination",
        "temperature_c_7d":    "high temperature vector control mosquito lifecycle acceleration",
        "wow_case_change_pct": "rapid case surge outbreak early warning emergency response",
        "recent_case_count":   "high case burden hospital capacity active surveillance",
        "vector_index":        "mosquito vector index larval density Aedes control",
        "humidity_pct":        "humidity mosquito survival rate vector abundance",
        "population_density":  "urban density crowded housing community intervention",
        "lag_1w_cases":        "lagged transmission incubation period case forecasting",
        "lag_2w_cases":        "lagged transmission incubation period case forecasting",
        "lag_3w_cases":        "lagged transmission incubation period case forecasting",
        "urbanization_index":  "urban density crowded housing community intervention",
    }

    def _build_query(
        self,
        district: str,
        model_risk_score: float,
        rainfall_mm_7d: float | None,
        temperature_c_7d: float | None,
        wow_case_change_pct: float | None,
        feature_importances: dict[str, float] | None = None,
    ) -> str:
        """Construct a natural-language retrieval query from district signals.

        When SHAP feature_importances are provided, query terms are weighted by
        each feature's contribution: dominant features (≥0.25) appear twice for
        stronger semantic signal. Falls back to threshold-based heuristics otherwise.
        """
        risk = _risk_label(model_risk_score)
        parts = [f"dengue {risk} risk {district} district Sri Lanka intervention response"]

        if feature_importances:
            sorted_fi = sorted(feature_importances.items(), key=lambda x: x[1], reverse=True)
            for feat, importance in sorted_fi[:5]:
                if importance < 0.05:
                    break
                terms = self._SHAP_FEATURE_TERMS.get(feat)
                if terms:
                    # High-importance features repeat to amplify their semantic weight
                    repeat = 2 if importance >= 0.25 else 1
                    parts.extend([terms] * repeat)
        else:
            if rainfall_mm_7d is not None and rainfall_mm_7d >= 80:
                parts.append("heavy rainfall standing water Aedes breeding site elimination")
            if temperature_c_7d is not None and temperature_c_7d >= 28:
                parts.append("high temperature vector control mosquito lifecycle acceleration")
            if wow_case_change_pct is not None and wow_case_change_pct >= 15:
                parts.append("rapid case surge outbreak early warning emergency response protocol")
            if risk in ("high", "critical"):
                parts.append("fogging fumigation rapid response team hospital preparedness")

        return " ".join(parts)
