"""RAG Service with Qdrant and Gemini API"""

import asyncio
import json
import os
import re
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import structlog
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    Fusion,
    FusionQuery,
    MatchValue,
    NamedVector,
    PointStruct,
    Prefetch,
    SparseVector,
    SparseVectorParams,
    VectorParams,
)
from google import genai
from google.genai import types as genai_types
from pypdf import PdfReader

from config import (
    ADMIN_API_KEY,
    DATA_DIR,
    GEMINI_API_KEY,
    MANIFEST_FILE,
    QDRANT_COLLECTION_NAME,
    QDRANT_URL,
    QDRANT_VECTOR_SIZE,
    RETRIEVAL_LIMIT,
    SCORE_THRESHOLD,
    SESSION_MAX_TURNS,
    SESSION_TTL_MINUTES,
)

log = structlog.get_logger(__name__)

# Valid categories matching the manifest
_VALID_CATEGORIES = {"symptoms", "prevention", "treatment", "epidemiology", "general"}


# ── Circuit breaker (Gemini API) ───────────────────────────────────────────────

class _CircuitBreaker:
    """Open after `threshold` consecutive failures; auto-resets after `reset_seconds`."""

    def __init__(self, threshold: int = 3, reset_seconds: int = 60):
        self._failures = 0
        self._open_until: datetime | None = None
        self._threshold = threshold
        self._reset_seconds = reset_seconds

    def is_open(self) -> bool:
        if self._open_until and datetime.now(timezone.utc) >= self._open_until:
            self._failures = 0
            self._open_until = None
        return self._open_until is not None

    def record_failure(self):
        self._failures += 1
        if self._failures >= self._threshold:
            self._open_until = datetime.now(timezone.utc) + timedelta(seconds=self._reset_seconds)
            log.warning("gemini_circuit_opened", failures=self._failures, reset_seconds=self._reset_seconds)

    def record_success(self):
        self._failures = 0
        self._open_until = None


_gemini_circuit = _CircuitBreaker()


# ── Session store ──────────────────────────────────────────────────────────────
# Structure: session_id → {"history": [{role, content, timestamp}], "last_active": datetime}
_sessions: dict[str, dict] = {}


def create_session() -> str:
    """Create a new session and return its ID."""
    session_id = str(uuid.uuid4())
    _sessions[session_id] = {
        "history": [],
        "last_active": datetime.now(timezone.utc),
    }
    return session_id


def get_session(session_id: str) -> dict | None:
    """Return the session dict (touching last_active) or None if not found."""
    session = _sessions.get(session_id)
    if session:
        session["last_active"] = datetime.now(timezone.utc)
    return session


def delete_session(session_id: str) -> bool:
    """Delete a session. Returns True if it existed."""
    return bool(_sessions.pop(session_id, None))


def cleanup_expired_sessions() -> int:
    """Remove sessions inactive for longer than SESSION_TTL_MINUTES. Returns count removed."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=SESSION_TTL_MINUTES)
    expired = [sid for sid, data in list(_sessions.items()) if data["last_active"] < cutoff]
    for sid in expired:
        del _sessions[sid]
    return len(expired)


def active_sessions_count() -> int:
    return len(_sessions)


# ── Startup validation ─────────────────────────────────────────────────────────

def validate_startup():
    """
    Validate the environment before the service starts accepting requests.
    - Missing GEMINI_API_KEY → warning only (service runs with fallback responses).
    - Qdrant unreachable → hard fail (service cannot function without vector DB).
    """
    if not GEMINI_API_KEY:
        log.warning("startup_warning", detail="GEMINI_API_KEY not set — fallback responses will be used")

    try:
        probe = QdrantClient(url=QDRANT_URL, timeout=5)
        probe.get_collections()
        log.info("startup_validation_passed", qdrant_url=QDRANT_URL)
    except Exception as e:
        raise RuntimeError(f"Qdrant unreachable at {QDRANT_URL}: {e}") from e


# ── Helpers ────────────────────────────────────────────────────────────────────

def _score_to_confidence(score: float) -> str:
    if score >= 0.7:
        return "high"
    if score >= 0.5:
        return "medium"
    return "low"


def _load_manifest() -> dict[str, dict]:
    """Load documents_manifest.json and return a filename→metadata dict."""
    if not os.path.exists(MANIFEST_FILE):
        return {}
    with open(MANIFEST_FILE, "r") as f:
        data = json.load(f)
    return {doc["filename"]: doc for doc in data.get("documents", [])}


class RAGService:
    """Retrieval-Augmented Generation service for dengue information"""

    def __init__(self):
        # Initialize Gemini
        if GEMINI_API_KEY:
            self.client = genai.Client(api_key=GEMINI_API_KEY)
            self.gen_model = "gemini-2.5-flash"
            self.embedding_model = "gemini-embedding-001"
        else:
            self.client = None
            self.gen_model = None
            self.embedding_model = None

        # Attempt to load BM25 sparse embedding model (optional — falls back gracefully)
        self.bm25_model = None
        try:
            from fastembed import SparseTextEmbedding
            self.bm25_model = SparseTextEmbedding(model_name="Qdrant/bm25")
            log.info("bm25_loaded", detail="hybrid search enabled")
        except Exception as e:
            log.warning("bm25_unavailable", error=str(e), detail="dense-only search will be used")

        # Initialize Qdrant and ensure collection schema is up to date
        self.qdrant = QdrantClient(url=QDRANT_URL)
        self._ensure_collection()

    # ── Collection management ──────────────────────────────────────────────────

    def _ensure_collection(self):
        """
        Create or migrate the Qdrant collection.
        Phase 3 schema: named 'dense' vector + 'sparse' slot for hybrid search.
        If an old unnamed-vector collection exists it is deleted so data is
        re-ingested cleanly on the next startup call to ingest_all_pdfs().
        """
        existing = {c.name for c in self.qdrant.get_collections().collections}

        if QDRANT_COLLECTION_NAME in existing:
            info = self.qdrant.get_collection(QDRANT_COLLECTION_NAME)
            vectors = info.config.params.vectors
            # Old schema: plain VectorParams (unnamed) — needs migration to named vectors
            if isinstance(vectors, VectorParams):
                log.info("collection_migration", collection=QDRANT_COLLECTION_NAME, reason="upgrading to named-vector schema")
                self.qdrant.delete_collection(QDRANT_COLLECTION_NAME)
            # Dimension mismatch — model changed (e.g. 768 → 3072)
            elif isinstance(vectors, dict) and vectors.get("dense") and vectors["dense"].size != QDRANT_VECTOR_SIZE:
                log.info("collection_migration", collection=QDRANT_COLLECTION_NAME,
                         reason=f"vector size mismatch: {vectors['dense'].size} → {QDRANT_VECTOR_SIZE}")
                self.qdrant.delete_collection(QDRANT_COLLECTION_NAME)
            else:
                return  # Already on the correct schema

        self.qdrant.create_collection(
            collection_name=QDRANT_COLLECTION_NAME,
            vectors_config={"dense": VectorParams(size=QDRANT_VECTOR_SIZE, distance=Distance.COSINE)},
            sparse_vectors_config={"sparse": SparseVectorParams()},
        )
        log.info("collection_created", collection=QDRANT_COLLECTION_NAME)

    # ── Embedding helpers ──────────────────────────────────────────────────────

    def _get_dense_embedding(self, text: str) -> list[float]:
        """Gemini text-embedding-004 dense vector (768-dim)."""
        if not self.client:
            return [0.0] * QDRANT_VECTOR_SIZE
        result = self.client.models.embed_content(
            model=self.embedding_model,
            contents=text,
            config=genai_types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT"),
        )
        return result.embeddings[0].values

    def _get_sparse_embedding(self, text: str) -> SparseVector | None:
        """BM25 sparse vector. Returns None when BM25 model is not available."""
        if not self.bm25_model:
            return None
        result = list(self.bm25_model.embed([text]))[0]
        return SparseVector(
            indices=result.indices.tolist(),
            values=result.values.tolist(),
        )

    # ── Semantic chunking ──────────────────────────────────────────────────────

    def _chunk_text(self, text: str, chunk_size: int = 1000, overlap: int = 200) -> list[str]:
        """
        Semantic-aware chunking:
          1. Split on paragraph boundaries (\\n\\n).
          2. For oversized paragraphs, split on sentence endings.
          3. Fall back to character splitting only for sentences that still exceed chunk_size.
        Overlap is taken from the tail of the previous chunk.
        """
        def _split_sentences(para: str) -> list[str]:
            return [s.strip() for s in re.split(r'(?<=[.!?])\s+', para) if s.strip()]

        paragraphs = [p.strip() for p in re.split(r'\n\s*\n', text) if p.strip()]
        chunks: list[str] = []
        current = ""

        def _flush(buf: str) -> str:
            """Save buf as a chunk and return the overlap tail for the next chunk."""
            if buf.strip():
                chunks.append(buf.strip())
                return buf[-overlap:].strip() if len(buf) > overlap else buf.strip()
            return ""

        for para in paragraphs:
            pieces = [para] if len(para) <= chunk_size else _split_sentences(para)

            for piece in pieces:
                # If piece itself exceeds chunk_size, split by characters
                if len(piece) > chunk_size:
                    if current:
                        current = _flush(current)
                    for i in range(0, len(piece), chunk_size - overlap):
                        sub = piece[i: i + chunk_size].strip()
                        if sub:
                            chunks.append(sub)
                    current = piece[-(overlap):].strip() if len(piece) > overlap else ""
                    continue

                if len(current) + len(piece) + 2 <= chunk_size:
                    current = (current + "\n\n" + piece).strip() if current else piece
                else:
                    current = _flush(current)
                    current = (current + " " + piece).strip() if current else piece

        if current.strip():
            chunks.append(current.strip())

        return [c for c in chunks if c.strip()]

    # ── Query classification ───────────────────────────────────────────────────

    def _classify_query(self, question: str) -> str:
        """
        Use Gemini to classify the query into a manifest category.
        Returns one of: symptoms | prevention | treatment | epidemiology | general | out_of_scope.
        Falls back to 'general' if classification fails or circuit is open.
        """
        if not self.client or _gemini_circuit.is_open():
            return "general"

        prompt = (
            "Classify the following question about dengue into exactly one category.\n\n"
            "Categories:\n"
            "- symptoms: dengue signs, fever, rash, warning signs, platelet count\n"
            "- prevention: mosquito control, repellents, eliminating breeding sites\n"
            "- treatment: medications, clinical management, hospitalization, nursing care\n"
            "- epidemiology: statistics, outbreaks, surveillance, national plans, trends\n"
            "- general: what is dengue, overview, transmission, lifecycle\n"
            "- out_of_scope: unrelated to dengue entirely\n\n"
            f"Question: {question}\n\n"
            "Reply with just the category name, nothing else."
        )
        try:
            resp = self.client.models.generate_content(model=self.gen_model, contents=prompt)
            category = resp.text.strip().lower()
            return category if category in _VALID_CATEGORIES | {"out_of_scope"} else "general"
        except Exception:
            return "general"

    # ── Ingestion ──────────────────────────────────────────────────────────────

    def _point_id(self, filename: str, chunk_index: int) -> str:
        return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{filename}:{chunk_index}"))

    def _is_already_ingested(self, filename: str) -> bool:
        results = self.qdrant.scroll(
            collection_name=QDRANT_COLLECTION_NAME,
            scroll_filter=Filter(
                must=[FieldCondition(key="source", match=MatchValue(value=filename))]
            ),
            limit=1,
            with_payload=False,
            with_vectors=False,
        )
        return len(results[0]) > 0

    def ingest_pdf(self, pdf_path: str, manifest: dict[str, dict] | None = None) -> int:
        """Ingest a PDF into Qdrant with dense + sparse (BM25) vectors and rich metadata."""
        t0 = time.monotonic()
        reader = PdfReader(pdf_path)
        filename = os.path.basename(pdf_path)
        doc_meta = (manifest or {}).get(filename, {})

        all_text = ""
        for page in reader.pages:
            text = page.extract_text()
            if text:
                all_text += text + "\n"

        chunks = self._chunk_text(all_text)
        points = []
        ingested_at = datetime.now(timezone.utc).isoformat()

        for i, chunk in enumerate(chunks):
            dense = self._get_dense_embedding(chunk)
            sparse = self._get_sparse_embedding(chunk)

            vectors: dict = {"dense": dense}
            if sparse is not None:
                vectors["sparse"] = sparse

            points.append(
                PointStruct(
                    id=self._point_id(filename, i),
                    vector=vectors,
                    payload={
                        "source": filename,
                        "document_title": doc_meta.get("title", filename),
                        "category": doc_meta.get("category", "general"),
                        "language": doc_meta.get("language", "en"),
                        "doc_source": doc_meta.get("source", "Unknown"),
                        "chunk_index": i,
                        "text": chunk,
                        "ingested_at": ingested_at,
                    },
                )
            )

        for batch_start in range(0, len(points), 100):
            self.qdrant.upsert(
                collection_name=QDRANT_COLLECTION_NAME,
                points=points[batch_start: batch_start + 100],
            )

        duration_ms = round((time.monotonic() - t0) * 1000)
        log.info("document_ingested", filename=filename, chunks=len(chunks), duration_ms=duration_ms)
        return len(chunks)

    def ingest_all_pdfs(self) -> dict:
        """Ingest all PDFs from the data directory, skipping already-ingested files."""
        results = {}
        if not os.path.exists(DATA_DIR):
            return {"error": f"Data directory {DATA_DIR} not found"}

        manifest = _load_manifest()

        for filename in os.listdir(DATA_DIR):
            if not filename.lower().endswith(".pdf"):
                continue
            if self._is_already_ingested(filename):
                results[filename] = {"status": "skipped", "reason": "already ingested"}
                continue
            pdf_path = os.path.join(DATA_DIR, filename)
            try:
                chunks_count = self.ingest_pdf(pdf_path, manifest)
                results[filename] = {"status": "success", "chunks": chunks_count}
            except Exception as e:
                log.error("ingestion_failed", filename=filename, error=str(e))
                results[filename] = {"status": "error", "message": str(e)}

        return results

    # ── Document management ────────────────────────────────────────────────────

    def delete_document(self, filename: str) -> int:
        point_ids = []
        offset = None
        while True:
            batch, offset = self.qdrant.scroll(
                collection_name=QDRANT_COLLECTION_NAME,
                scroll_filter=Filter(
                    must=[FieldCondition(key="source", match=MatchValue(value=filename))]
                ),
                limit=100,
                offset=offset,
                with_payload=False,
                with_vectors=False,
            )
            point_ids.extend([p.id for p in batch])
            if offset is None:
                break

        if point_ids:
            self.qdrant.delete(
                collection_name=QDRANT_COLLECTION_NAME,
                points_selector=point_ids,
            )
            log.info("document_deleted", filename=filename, chunks_removed=len(point_ids))
        return len(point_ids)

    def list_documents(self) -> list[dict]:
        counts: dict[str, dict] = {}
        offset = None
        while True:
            batch, offset = self.qdrant.scroll(
                collection_name=QDRANT_COLLECTION_NAME,
                limit=100,
                offset=offset,
                with_payload=["source", "document_title", "category", "language", "doc_source", "ingested_at"],
                with_vectors=False,
            )
            for point in batch:
                src = point.payload.get("source", "unknown")
                if src not in counts:
                    counts[src] = {
                        "source": src,
                        "document_title": point.payload.get("document_title", src),
                        "category": point.payload.get("category", "general"),
                        "language": point.payload.get("language", "en"),
                        "doc_source": point.payload.get("doc_source", "Unknown"),
                        "ingested_at": point.payload.get("ingested_at"),
                        "chunk_count": 0,
                    }
                counts[src]["chunk_count"] += 1
            if offset is None:
                break
        return list(counts.values())

    # ── Query & generation ────────────────────────────────────────────────────

    async def query(
        self,
        question: str,
        n_results: int = RETRIEVAL_LIMIT,
        category: str | None = None,
        session_id: str | None = None,
    ) -> dict:
        """
        Async query pipeline:
          1. Load session history.
          2. Classify query intent (→ category filter, out-of-scope guard).
          3. Build retrieval query (enrich with last 1-2 user turns).
          4. Embed query (async via to_thread).
          5. Hybrid or dense search (async via to_thread).
          6. Score filter + confidence scoring.
          7. Generate response (native async Gemini call, circuit-breaker guarded).
          8. Log query event. Persist turn in session.
        """
        t0 = time.monotonic()

        # 1. Load session
        session = get_session(session_id) if session_id else None
        history: list[dict] = session["history"] if session else []

        # 2. Classify
        if category:
            detected_category = category
        else:
            detected_category = await asyncio.to_thread(self._classify_query, question)

        if detected_category == "out_of_scope":
            out_of_scope_msg = (
                "I'm EpiBot, specializing in dengue fever information. "
                "I'm not able to help with that topic, but I'm happy to answer any questions "
                "about dengue symptoms, prevention, treatment, or related health guidance."
            )
            self._persist_turn(session, history, question, out_of_scope_msg)
            return {"response": out_of_scope_msg, "sources": [], "confidence": "high"}

        search_filter = None
        if detected_category and detected_category in _VALID_CATEGORIES and detected_category != "general":
            search_filter = Filter(
                must=[FieldCondition(key="category", match=MatchValue(value=detected_category))]
            )

        # 3. Retrieval query — prepend last 1-2 user turns to resolve pronouns
        recent_user_turns = [h["content"] for h in history[-4:] if h["role"] == "user"][-2:]
        retrieval_query = " ".join(recent_user_turns + [question]) if recent_user_turns else question

        # 4. Embed (async)
        dense_vector = await asyncio.to_thread(self._get_dense_embedding, retrieval_query)
        sparse_vector = (
            await asyncio.to_thread(self._get_sparse_embedding, retrieval_query)
            if self.bm25_model else None
        )

        # 5. Search (async)
        if sparse_vector is not None:
            results = await asyncio.to_thread(
                self.qdrant.query_points,
                collection_name=QDRANT_COLLECTION_NAME,
                prefetch=[
                    Prefetch(query=dense_vector, using="dense", limit=n_results * 2),
                    Prefetch(query=sparse_vector, using="sparse", limit=n_results * 2),
                ],
                query=FusionQuery(fusion=Fusion.RRF),
                limit=n_results,
                query_filter=search_filter,
                with_payload=True,
            )
            hits = results.points
        else:
            hits = await asyncio.to_thread(
                self.qdrant.search,
                collection_name=QDRANT_COLLECTION_NAME,
                query_vector=NamedVector(name="dense", vector=dense_vector),
                limit=n_results,
                query_filter=search_filter,
                with_payload=True,
            )

        # 6. Score filtering (dense-only path; RRF uses rank scores)
        if sparse_vector is None:
            hits = [h for h in hits if h.score >= SCORE_THRESHOLD]

        confidence = _score_to_confidence(hits[0].score) if hits else "low"

        context_parts = []
        sources = []
        for hit in hits:
            text = hit.payload.get("text", "")
            title = hit.payload.get("document_title", hit.payload.get("source", "Unknown"))
            context_parts.append(f"[Source: {title}]\n{text}")
            sources.append({
                "title": title,
                "snippet": text[:200] + "..." if len(text) > 200 else text,
            })

        context = "\n\n".join(context_parts)

        # No Gemini client available
        if not self.client:
            fallback_answer = self._get_fallback_response(question)
            self._persist_turn(session, history, question, fallback_answer)
            return {
                "response": fallback_answer,
                "sources": sources,
                "confidence": confidence,
                "note": "Running without Gemini API key — using fallback responses",
            }

        # 7. Build conversation-aware prompt
        low_confidence_note = (
            "\n\nNote: My knowledge base has limited information on this specific query. "
            "Please consult a healthcare professional or the Ministry of Health for authoritative guidance."
            if confidence == "low" else ""
        )

        conversation_block = ""
        if history:
            recent = history[-(SESSION_MAX_TURNS * 2):]
            lines = [
                f"{'User' if h['role'] == 'user' else 'EpiBot'}: {h['content']}"
                for h in recent
            ]
            conversation_block = "\n\nPrior conversation:\n" + "\n".join(lines)

        prompt = f"""You are EpiBot, a trusted public health assistant specializing in dengue fever \
information for Sri Lanka. You answer questions for members of the public, patients, and caregivers.

Guidelines:
- Base your answer on the provided context documents. Cite the source document name when relevant.
- If the context is insufficient, draw on established dengue medical knowledge but say so clearly.
- For questions about symptoms or treatment, always advise the user to consult a healthcare professional.
- For emergency warning signs (severe abdominal pain, bleeding, rapid breathing), stress the urgency of \
seeking immediate medical care.
- Respond in the same language the user wrote in (English, Sinhala, or Tamil).
- Do not answer questions unrelated to dengue or public health.
- Use the prior conversation to resolve follow-up questions (e.g., "it", "those symptoms", "that treatment").

Context documents:
{context if context else "No specific context retrieved."}{conversation_block}

User question: {question}

Provide a clear, accurate, and concise answer.{low_confidence_note}"""

        # 8. Generate (circuit-breaker guarded, native async)
        note = None
        if _gemini_circuit.is_open():
            answer = self._retrieval_only_response(context_parts)
            note = "AI generation temporarily unavailable — showing retrieved information only."
            log.warning("gemini_circuit_open_fallback", question_preview=question[:80])
        else:
            try:
                response = await self.client.aio.models.generate_content(
                    model=self.gen_model,
                    contents=prompt,
                )
                _gemini_circuit.record_success()
                answer = response.text
            except Exception as e:
                _gemini_circuit.record_failure()
                log.error("gemini_generation_failed", error=str(e))
                answer = self._retrieval_only_response(context_parts)
                note = "AI generation temporarily unavailable — showing retrieved information only."

        latency_ms = round((time.monotonic() - t0) * 1000)
        log.info(
            "query_completed",
            question_preview=question[:100],
            session_id=session_id,
            category=detected_category,
            confidence=confidence,
            chunks_retrieved=len(hits),
            latency_ms=latency_ms,
            model="gemini-2.5-flash",
        )

        self._persist_turn(session, history, question, answer)

        result: dict = {"response": answer, "sources": sources, "confidence": confidence}
        if note:
            result["note"] = note
        return result

    # ── Helpers ────────────────────────────────────────────────────────────────

    def _persist_turn(self, session: dict | None, history: list[dict], question: str, answer: str):
        if session is None:
            return
        now = datetime.now(timezone.utc).isoformat()
        history.append({"role": "user", "content": question, "timestamp": now})
        history.append({"role": "assistant", "content": answer, "timestamp": now})
        session["history"] = history[-(SESSION_MAX_TURNS * 2):]

    def _retrieval_only_response(self, context_parts: list[str]) -> str:
        if not context_parts:
            return "I couldn't find relevant information in my knowledge base for this question."
        return "Here is the most relevant information I found:\n\n" + "\n\n".join(context_parts[:3])

    def _get_fallback_response(self, question: str) -> str:
        question_lower = question.lower()
        if "symptom" in question_lower:
            return (
                "Common dengue symptoms include: high fever (40°C/104°F), severe headache, "
                "pain behind the eyes, muscle and joint pains, nausea, vomiting, swollen glands, "
                "and skin rash. If you experience these symptoms, please consult a doctor immediately."
            )
        elif "prevent" in question_lower or "avoid" in question_lower:
            return (
                "To prevent dengue: 1) Eliminate standing water where mosquitoes breed, "
                "2) Use mosquito repellents, 3) Wear long-sleeved clothes, 4) Use mosquito nets, "
                "5) Keep windows and doors screened, 6) Report potential breeding sites to authorities."
            )
        elif "treatment" in question_lower or "cure" in question_lower:
            return (
                "There is no specific antiviral treatment for dengue. Treatment is supportive: "
                "rest, drink plenty of fluids, take paracetamol for fever and pain. "
                "AVOID aspirin and ibuprofen as they can increase bleeding risk. "
                "Seek immediate medical care if symptoms worsen."
            )
        elif "risk" in question_lower or "danger" in question_lower:
            return (
                "Dengue is most dangerous when it progresses to severe dengue (dengue hemorrhagic fever). "
                "Warning signs include: severe abdominal pain, persistent vomiting, rapid breathing, "
                "bleeding gums, blood in vomit, fatigue and restlessness. Seek emergency care immediately."
            )
        else:
            return (
                "I'm EpiBot, your dengue information assistant. I can help you with:\n"
                "• Dengue symptoms and warning signs\n"
                "• Prevention tips and mosquito control\n"
                "• Treatment guidelines\n"
                "• Risk factors and when to seek medical help\n\n"
                "What would you like to know about dengue?"
            )

    # ── Stats ──────────────────────────────────────────────────────────────────

    def get_collection_stats(self) -> dict:
        info = self.qdrant.get_collection(QDRANT_COLLECTION_NAME)
        return {
            "collection_name": QDRANT_COLLECTION_NAME,
            "document_count": info.points_count,
            "qdrant_url": QDRANT_URL,
            "hybrid_search": self.bm25_model is not None,
            "active_sessions": active_sessions_count(),
        }


# Singleton instance
_rag_service: Optional[RAGService] = None


def get_rag_service() -> RAGService:
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service
