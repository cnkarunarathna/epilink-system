"""
Phase 2: pgvector-backed RAG retrieval service.

Handles:
- Embedding generation via Google text-embedding-004
- Document ingestion into a pgvector table
- Semantic retrieval using cosine similarity
- Graceful no-op when pgvector is not configured
"""

from explain_analytics.config import settings
from explain_analytics.models import DocumentReference, RagIngestDocument

# Cosine similarity threshold — documents below this are too irrelevant to include.
_MIN_RELEVANCE_SCORE = 0.55

_CREATE_EXTENSION = "CREATE EXTENSION IF NOT EXISTS vector;"

_CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS rag_documents (
    id          SERIAL PRIMARY KEY,
    title       TEXT NOT NULL,
    source      TEXT NOT NULL,
    published_date TEXT,
    content     TEXT NOT NULL,
    embedding   vector(768),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
"""

_CREATE_INDEX = """
CREATE INDEX IF NOT EXISTS rag_docs_embedding_idx
    ON rag_documents
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 50);
"""

_RETRIEVE_SQL = """
SELECT
    title,
    source,
    published_date,
    LEFT(content, 600)                    AS excerpt,
    1 - (embedding <=> %s::vector)        AS score
FROM rag_documents
WHERE 1 - (embedding <=> %s::vector) >= %s
ORDER BY embedding <=> %s::vector
LIMIT %s;
"""

_INSERT_SQL = """
INSERT INTO rag_documents (title, source, published_date, content, embedding)
VALUES (%s, %s, %s, %s, %s::vector);
"""


def _risk_label(score: float) -> str:
    if score >= 0.85:
        return "critical"
    if score >= 0.65:
        return "high"
    if score >= 0.40:
        return "moderate"
    return "low"


class RAGService:
    """Semantic retrieval over the MoH dengue document corpus stored in pgvector."""

    def __init__(self) -> None:
        self._ready = bool(settings.pgvector_url and settings.rag_enabled)
        if self._ready:
            self._ensure_table()

    # ── Public API ──────────────────────────────────────────────────

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
        """Embed and store documents in pgvector. Returns count of stored documents."""
        if not settings.pgvector_url:
            raise RuntimeError(
                "EXPLAIN_PGVECTOR_URL is not set. "
                "Configure it in .env before ingesting documents."
            )
        self._ensure_table()
        stored = 0
        try:
            import psycopg
            from pgvector.psycopg import register_vector

            with psycopg.connect(settings.pgvector_url) as conn:
                register_vector(conn)
                for doc in documents:
                    embedding = self._embed(doc.content)
                    conn.execute(
                        _INSERT_SQL,
                        (doc.title, doc.source, doc.published_date, doc.content, embedding),
                    )
                    stored += 1
                conn.commit()
        except Exception as exc:
            raise RuntimeError(f"Ingestion failed after {stored} document(s): {exc}") from exc
        return stored

    def document_count(self) -> int:
        """Return the total number of documents in the corpus."""
        if not settings.pgvector_url:
            return 0
        try:
            import psycopg

            with psycopg.connect(settings.pgvector_url) as conn:
                row = conn.execute("SELECT COUNT(*) FROM rag_documents;").fetchone()
                return int(row[0]) if row else 0
        except Exception:
            return 0

    # ── Internal helpers ────────────────────────────────────────────

    def _ensure_table(self) -> None:
        """Create the pgvector extension and rag_documents table if absent."""
        if not settings.pgvector_url:
            return
        try:
            import psycopg
            from pgvector.psycopg import register_vector

            with psycopg.connect(settings.pgvector_url) as conn:
                register_vector(conn)
                conn.execute(_CREATE_EXTENSION)
                conn.execute(_CREATE_TABLE)
                conn.execute(_CREATE_INDEX)
                conn.commit()
        except Exception as exc:
            print(f"[RAGService] Could not ensure table: {exc}")
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

    def _vector_search(
        self, embedding: list[float], top_k: int
    ) -> list[DocumentReference]:
        import psycopg
        from pgvector.psycopg import register_vector

        with psycopg.connect(settings.pgvector_url) as conn:  # type: ignore[arg-type]
            register_vector(conn)
            rows = conn.execute(
                _RETRIEVE_SQL,
                (embedding, embedding, _MIN_RELEVANCE_SCORE, embedding, top_k),
            ).fetchall()

        return [
            DocumentReference(
                title=row[0],
                source=row[1],
                published_date=row[2],
                excerpt=row[3],
                relevance_score=round(float(row[4]), 3),
            )
            for row in rows
        ]
