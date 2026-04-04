# EpiBot Public Chatbot — RAG Enhancement Plan

## Current State Summary

The chatbot service is a functional but basic RAG implementation:
- **Framework**: FastAPI + Uvicorn
- **LLM**: Gemini 2.5-flash (via `google-generativeai`)
- **Embeddings**: `text-embedding-004` (Gemini)
- **Vector DB**: ChromaDB (local persistent, SQLite + HNSWLIB)
- **Knowledge source**: Single dengue leaflet PDF (~1 MB)
- **Chunking**: Fixed 1000-char chunks with 200-char overlap
- **Retrieval**: Top-3 similarity search, no reranking
- **Session**: `session_id` accepted but not used

---

## Vector Database Recommendation: Qdrant over ChromaDB

**Recommendation: Migrate to Qdrant on Docker.**

| Criteria | ChromaDB (current) | Qdrant (recommended) |
|---|---|---|
| Architecture | Embedded SQLite + HNSWLIB | Purpose-built vector engine |
| Docker support | No official production image | Official Docker image, battle-tested |
| Web UI | None | Built-in dashboard at `:6333/dashboard` |
| Payload filtering | Basic | Advanced — filter by category, language, date, etc. |
| Hybrid search | No | Yes — dense + sparse (BM25) vectors |
| Performance at scale | Degrades with large collections | Optimized for production scale |
| Snapshots/backup | Manual file copy | Native snapshot API |
| Observability | None | REST API for collection stats, health, telemetry |
| Python client | `chromadb` | `qdrant-client` (well-maintained, async support) |

**Why Qdrant wins for this use case:**
1. The web UI dashboard lets you inspect, search, and debug the vector collection without writing code — invaluable for a growing document library.
2. Payload filtering allows precise retrieval by document category, language, or topic — critical as the knowledge base grows beyond a single PDF.
3. Hybrid search (dense + sparse) significantly improves retrieval quality for medical/technical queries where exact keyword matching matters alongside semantic similarity.
4. Native Docker with a persistent volume makes it a first-class service in the docker-compose stack alongside the other EpiLink services.

---

## Implementation Phases

---

### Phase 1 — Vector Database Migration (ChromaDB → Qdrant)

**Goal**: Replace ChromaDB with Qdrant running in Docker. No feature changes — purely an infrastructure swap with a cleaner foundation.

**Tasks**:

1. **Add Qdrant to docker-compose**
   - Add `qdrant/qdrant` service with persistent volume
   - Expose port `6333` (REST + web UI) and `6334` (gRPC)
   - Configure `QDRANT_URL` environment variable in chatbot service

2. **Update dependencies** (`pyproject.toml`)
   - Remove `chromadb>=1.4.0`
   - Add `qdrant-client>=1.14.0`

3. **Update `config.py`**
   - Remove `CHROMA_PERSIST_DIR`, `COLLECTION_NAME`
   - Add `QDRANT_URL` (default: `http://localhost:6333`)
   - Add `QDRANT_COLLECTION_NAME` (default: `dengue_knowledge`)
   - Add `QDRANT_VECTOR_SIZE` (default: `768` — matches `text-embedding-004`)

4. **Rewrite `services/rag_service.py`**
   - Replace `chromadb.PersistentClient` with `QdrantClient`
   - Replace `collection.upsert()` with `client.upsert(collection_name, points=[PointStruct(...)])`
   - Replace `collection.query()` with `client.search(collection_name, query_vector=..., limit=...)`
   - Create collection on startup with `VectorParams(size=768, distance=Distance.COSINE)`
   - Map existing metadata fields: `source`, `chunk_index` → Qdrant payload
   - Use UUID-based point IDs (deterministic from `filename + chunk_index` for upsert safety)

5. **Remove ChromaDB artifacts**
   - Delete `chroma_db/` directory from the project
   - Remove ChromaDB from `.gitignore` entries if present

6. **Verify parity**
   - `/health` endpoint still returns collection stats
   - `/chat` returns responses with sources
   - `/ingest` re-ingests the PDF successfully
   - Qdrant dashboard (`http://localhost:6333/dashboard`) shows the collection

**Deliverable**: Qdrant-backed service passing all existing behavior, ChromaDB fully removed.

---

### Phase 2 — Document Library & Metadata Schema

**Goal**: Build a structured, queryable document library that supports multiple dengue-related documents with rich metadata for filtered retrieval.

**Tasks**:

1. **Define metadata schema** for all ingested chunks
   ```
   {
     "source_file": "filename.pdf",
     "document_title": "Dengue Prevention Guide",
     "category": "prevention" | "symptoms" | "treatment" | "epidemiology" | "general",
     "language": "en" | "si" | "ta",
     "chunk_index": 0,
     "page_number": 1,
     "ingested_at": "2026-04-04T00:00:00Z"
   }
   ```

2. **Expand the document library** (`data/`)
   - Add WHO dengue guidelines PDF
   - Add Sri Lanka Ministry of Health dengue bulletins
   - Add Sinhala and Tamil language versions if available
   - Add a `documents_manifest.json` describing each file's title, category, and language

3. **Update ingestion pipeline**
   - Read `documents_manifest.json` to attach metadata during ingestion
   - Extract page numbers from `PdfReader` and store per chunk
   - Track `ingested_at` timestamp per chunk

4. **Category-aware retrieval**
   - Accept optional `category` filter in `ChatRequest`
   - Pass Qdrant filter to `client.search()` when category is specified
   - Example: symptom questions auto-filter to `category: symptoms`

5. **Add document management API endpoints**
   - `GET /documents` — list all ingested documents with chunk counts
   - `DELETE /documents/{source_file}` — remove all chunks for a document
   - `POST /ingest` — accept optional `category` and `language` body params

6. **Avoid re-ingestion on restart**
   - Check if a document's chunks already exist in Qdrant before ingesting
   - Only re-ingest if the file's modification time changed (store in payload)

**Deliverable**: Multi-document knowledge base with rich metadata, filterable by category and language.

---

### Phase 3 — RAG Pipeline Quality Improvements

**Goal**: Improve retrieval accuracy and response quality through better chunking, hybrid search, and smarter prompt construction.

**Tasks**:

1. **Semantic-aware chunking** (replace fixed-size chunking)
   - Split on paragraph boundaries (`\n\n`) first
   - Only subdivide paragraphs that exceed `chunk_size`
   - Preserve sentence integrity — never cut mid-sentence
   - Add `langchain-text-splitters` or implement `RecursiveCharacterTextSplitter` logic manually (no full LangChain dependency needed)

2. **Increase retrieval breadth + score filtering**
   - Raise `n_results` from 3 to 6
   - Filter out chunks with cosine similarity below `0.4` threshold
   - Log retrieval scores for monitoring

3. **Hybrid search with sparse vectors** (Qdrant native feature)
   - Generate sparse vectors using BM25 or SPLADE alongside dense embeddings
   - Use Qdrant's `Query` API with `prefetch` + RRF (Reciprocal Rank Fusion) to merge results
   - This improves retrieval for exact medical terms (e.g., "thrombocytopenia", "dengue NS1 antigen")

4. **Query classification**
   - Before retrieval, classify the query intent: `symptom_check`, `prevention`, `treatment`, `emergency`, `general`
   - Use a lightweight Gemini call with a short classification prompt
   - Apply category filter in Qdrant based on classified intent

5. **Improved prompt engineering**
   - Add few-shot examples for common query types
   - Include source document title in the context block
   - Add explicit instruction to cite the source document
   - Handle "out of scope" queries gracefully (non-dengue questions)
   - Language detection — respond in the user's language if Sinhala/Tamil detected

6. **Response confidence indicator**
   - If top retrieval score < `0.5`, append a low-confidence note to the response
   - Return `confidence: "high" | "medium" | "low"` in `ChatResponse`

**Deliverable**: Noticeably higher relevance and accuracy in responses, with hybrid search and smarter context building.

---

### Phase 4 — Conversation Memory & Session Management

**Goal**: Support multi-turn conversations so users can ask follow-up questions with context from prior turns in the same session.

**Tasks**:

1. **Session store**
   - Use an in-memory dict for MVP (acceptable for a single-instance service)
   - Structure: `session_id → list[{role, content, timestamp}]`
   - Cap history at last 6 turns to keep prompt size bounded

2. **Wire up `session_id` in `/chat`**
   - If `session_id` is provided, load history from store
   - Append current question to history
   - Build a conversation-aware prompt:
     ```
     [System: You are EpiBot...]
     [Prior conversation turns]
     [Retrieved context]
     [Current question]
     ```
   - Store the assistant response back into history

3. **Conversation-aware retrieval**
   - Concatenate last 1-2 turns with the current query before embedding, to resolve pronouns ("it", "this disease", "those symptoms")

4. **Session lifecycle**
   - `POST /session` — create a new session, return `session_id`
   - `DELETE /session/{session_id}` — explicitly end a session
   - Auto-expire sessions after 30 minutes of inactivity (background cleanup task)

5. **Session stats in `/health`**
   - Report `active_sessions` count

**Deliverable**: Users can have coherent multi-turn conversations; follow-up questions resolve correctly.

---

### Phase 5 — Production Hardening

**Goal**: Make the service safe, observable, and robust for public deployment.

**Tasks**:

1. **Rate limiting**
   - Add `slowapi` middleware
   - Limit `/chat` to 20 requests/minute per IP
   - Return `429 Too Many Requests` with a `Retry-After` header

2. **Admin endpoint security**
   - Protect `POST /ingest`, `DELETE /documents/*`, `POST /session` with an `X-Admin-Key` header
   - Key read from `ADMIN_API_KEY` environment variable

3. **Async I/O throughout**
   - Convert `RAGService` methods to `async def`
   - Use `qdrant-client`'s async client (`AsyncQdrantClient`)
   - Use `google-genai` async API for embedding and generation calls
   - Remove blocking I/O from the FastAPI event loop

4. **Structured logging**
   - Add `structlog` or Python `logging` with JSON formatter
   - Log: query text (truncated), session_id, retrieval scores, response latency, model used
   - Log ingestion events: document name, chunk count, duration

5. **Docker Compose integration**
   - Add `chatbot-service` and `qdrant` to the main `docker-compose.yml`
   - Define health checks for both services
   - Mount `data/` as a read-only volume
   - Use named volume for Qdrant persistence (`qdrant_storage`)

6. **Graceful error handling**
   - Distinguish between Gemini API errors, Qdrant errors, and ingestion errors
   - Return structured error responses: `{error_code, message, suggestion}`
   - Circuit-breaker for Gemini API (fall back to retrieval-only response if API is down)

7. **Environment validation on startup**
   - Validate `GEMINI_API_KEY` is set and reachable
   - Validate Qdrant is reachable before accepting requests
   - Fail fast with a clear error message rather than silently degrading

**Deliverable**: Production-ready service with rate limiting, admin auth, async I/O, structured logs, and full docker-compose integration.

---

## File Change Summary by Phase

| File | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 |
|---|---|---|---|---|---|
| `docker-compose.yml` | Add Qdrant service | — | — | — | Full integration |
| `pyproject.toml` | Swap chromadb→qdrant-client | Add manifest loader | Add text splitter | Add session deps | Add slowapi, structlog |
| `config.py` | Qdrant config vars | Data dir / manifest | Chunking params | Session config | Rate limit, admin key |
| `services/rag_service.py` | Full rewrite for Qdrant | Metadata schema, ingest | Hybrid search, query class | Session-aware query | Async, circuit breaker |
| `main.py` | Minor (endpoint labels) | Document mgmt endpoints | Confidence in response | Session endpoints | Rate limit middleware |
| `data/` | — | Add documents + manifest | — | — | — |

---

## Quick Reference: Key Dependencies to Add

```toml
# Phase 1
"qdrant-client>=1.14.0"

# Phase 3
# No extra dep needed — implement recursive splitting manually

# Phase 4
# No extra dep for in-memory sessions

# Phase 5
"slowapi>=0.1.9"       # rate limiting
"structlog>=24.0.0"    # structured logging
```

---

## Docker Compose — Shared Qdrant Instance

The project already runs a Qdrant instance used by `explain-analytics` (collection: `epilink_rag`). The chatbot service shares this same instance using a separate collection `dengue_knowledge`. Collections are fully isolated in Qdrant — no interference between the two services.

**No new Qdrant service is needed.** The `chatbot-service` entry in `docker-compose.yml` has been updated:

```yaml
chatbot-service:
  ...
  environment:
    HOST: 0.0.0.0
    PORT: 8000
    DATA_DIR: /app/data
    QDRANT_URL: http://qdrant:6333
    QDRANT_COLLECTION_NAME: dengue_knowledge
  depends_on:
    - qdrant
  ports:
    - "8002:8000"
```

The `chatbot_chroma` named volume has been removed from the compose file.
