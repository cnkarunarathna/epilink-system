# EpiBot Public Chatbot — RAG Enhancement Plan

## Current State Summary

> **All phases complete (1–5).**

The chatbot service as originally found:
- **Framework**: FastAPI + Uvicorn
- **LLM**: Gemini 2.5-flash (via `google-generativeai`)
- **Embeddings**: `text-embedding-004` (Gemini)
- **Vector DB**: ~~ChromaDB (local persistent, SQLite + HNSWLIB)~~ → **Qdrant** (shared instance)
- **Knowledge source**: ~~Single dengue leaflet PDF~~ → **6 PDFs** with rich metadata
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

### ✅ Phase 1 — Vector Database Migration (ChromaDB → Qdrant) — COMPLETE

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

### ✅ Phase 2 — Document Library & Metadata Schema — COMPLETE

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

### ✅ Phase 3 — RAG Pipeline Quality Improvements — COMPLETE

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

### ✅ Phase 4 — Conversation Memory & Session Management — COMPLETE

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

### ✅ Phase 5 — Production Hardening — COMPLETE

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

---

## Phase 6 — Public Chatbot UI Enhancement

> **Status**: Complete.

### Objective

Deliver an intuitive, responsive chatbot interface that correctly surfaces all data the backend already returns (`response`, `sources`, `confidence`, `note`, `session_id`) and renders AI-generated content with proper formatting.

---

### Current State Audit

| Concern | Current Behaviour | Target Behaviour |
|---|---|---|
| Response rendering | Plain text (`{message.content}`) | Markdown rendered (lists, bold, code blocks) |
| `sources` field | Ignored | Collapsible source citations below each response |
| `confidence` field | Ignored | Inline badge (`High / Medium / Low`) on assistant bubbles |
| `note` field | Ignored | Soft warning pill under the message when present |
| `session_id` | Read from `data.session_id` — **not in `ChatResponse` model** | Backend fix: add `session_id` to `ChatResponse`; frontend reads it |
| Responsive width | Fixed `w-[380px]` — clips on narrow phones | Full-screen on mobile (`<640px`), fixed panel on desktop |
| Suggested questions | None | 3 quick-tap chips on welcome screen |
| Typing indicator | 3-dot bounce (correct) | Keep as-is |
| Error state | Generic fallback text | Distinct error bubble with retry button |
| Copy response | None | Copy-to-clipboard icon on assistant bubbles |
| Chat header | Static | Show online/offline indicator based on `/health` poll |
| Empty state | Shows welcome message only | Welcome + 3 suggestion chips |
| Input area | Single-line `<input>` | Auto-growing `<textarea>` (max 4 lines) for longer questions |
| Scroll behaviour | `scrollIntoView` on every message | Smooth scroll, paused if user scrolled up |
| Timestamps | Stored but not rendered | Show relative time on hover/tap |

---

### Data Contract Changes Required

#### Backend — `chatbot-service/main.py`

Add `session_id` to `ChatResponse` so the frontend does not need a separate session creation call to persist the ID:

```python
class ChatResponse(BaseModel):
    response: str
    sources: list[dict] = []
    confidence: Optional[str] = None   # "high" | "medium" | "low"
    note: Optional[str] = None
    session_id: Optional[str] = None   # ← ADD: echo back the active session_id
```

Update the `/chat` endpoint to include `session_id` in the returned dict from `rag_service.query()`, or inject it explicitly:

```python
result = await rag_service.query(body.message, category=body.category, session_id=body.session_id)
result["session_id"] = body.session_id  # echo back so frontend can persist on first turn
return ChatResponse(**result)
```

#### Frontend — `ChatMessage` interface

```ts
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: Source[];
  confidence?: "high" | "medium" | "low";
  note?: string;
  isError?: boolean;
}

interface Source {
  document_title?: string;
  source_file?: string;
  category?: string;
  page_number?: number;
  score?: number;
}
```

---

### Component Architecture

```
ChatbotWidget (root, state + session management)
├── ChatFAB (floating action button — shown when closed)
├── ChatPanel (the visible window)
│   ├── ChatHeader (title, status dot, close button)
│   ├── ChatMessageList (scrollable, virtualisable)
│   │   ├── ChatMessageBubble (user variant)
│   │   └── ChatMessageBubble (assistant variant)
│   │       ├── MarkdownContent (react-markdown renderer)
│   │       ├── ConfidenceBadge (optional)
│   │       ├── NoteWarning (optional)
│   │       ├── SourceCitations (collapsible)
│   │       └── CopyButton
│   ├── SuggestionChips (shown only when messages.length === 1)
│   ├── TypingIndicator (shown when isTyping)
│   └── ChatInputBar
│       ├── AutoResizeTextarea
│       └── SendButton
```

All sub-components stay in the same file unless they grow beyond ~60 lines, at which point they move to sibling files under `frontend/components/chatbot/`.

---

### Markdown Rendering

Install `react-markdown` and `remark-gfm` (GitHub Flavoured Markdown — tables, strikethrough, task lists):

```bash
npm install react-markdown remark-gfm
```

Render assistant message content through a thin wrapper:

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Tailwind-compatible element overrides
        p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="list-disc pl-4 mb-1 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-4 mb-1 space-y-0.5">{children}</ol>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        code: ({ children }) => (
          <code className="bg-black/10 rounded px-1 py-0.5 text-xs font-mono">{children}</code>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
```

---

### Responsive Layout

| Breakpoint | Behaviour |
|---|---|
| `< 640px` (mobile) | Chat panel takes full viewport (`fixed inset-0`) |
| `≥ 640px` (tablet+) | Fixed bottom-right panel `w-[400px] h-[560px]` |

Use Tailwind responsive variants:

```tsx
className="fixed bottom-0 right-0 z-50
  w-full h-full
  sm:bottom-6 sm:right-6 sm:w-[400px] sm:h-[560px]
  sm:rounded-2xl"
```

The chat panel should always cap its height at `calc(100vh - 3rem)` on desktop to avoid overflow on small laptop screens.

---

### Confidence Badge

```tsx
const CONFIDENCE_CONFIG = {
  high:   { label: "High confidence",   className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  medium: { label: "Medium confidence", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  low:    { label: "Low confidence",    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
};

function ConfidenceBadge({ level }: { level: "high" | "medium" | "low" }) {
  const cfg = CONFIDENCE_CONFIG[level];
  return (
    <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", cfg.className)}>
      {cfg.label}
    </span>
  );
}
```

---

### Source Citations

Render as a collapsible `<details>` element below the message bubble. Each source shows the document title, category badge, and page number if available.

```tsx
function SourceCitations({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;
  return (
    <details className="mt-1 text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none hover:text-foreground transition-colors">
        {sources.length} source{sources.length > 1 ? "s" : ""}
      </summary>
      <ul className="mt-1 space-y-0.5 pl-2 border-l border-muted">
        {sources.map((src, i) => (
          <li key={i}>
            <span className="font-medium">{src.document_title ?? src.source_file}</span>
            {src.page_number != null && <span> · p.{src.page_number}</span>}
            {src.category && (
              <span className="ml-1 px-1 bg-muted rounded text-[10px]">{src.category}</span>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
```

---

### Suggestion Chips

Shown below the welcome message when no user message has been sent yet:

```tsx
const SUGGESTIONS = [
  "What are the early symptoms of dengue?",
  "How can I prevent dengue at home?",
  "When should I go to the hospital?",
];

function SuggestionChips({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 px-4 pb-2">
      {SUGGESTIONS.map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className="text-xs rounded-full border px-3 py-1.5 hover:bg-muted transition-colors text-left"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
```

---

### Auto-Resize Textarea

Replace the single-line `<input>` with an `<textarea>` that grows up to 4 lines:

```tsx
function AutoResizeTextarea({ value, onChange, onKeyDown, placeholder, disabled, inputRef }) {
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`; // 4 × 24px line-height
  }, [value]);

  return (
    <textarea
      ref={inputRef}
      rows={1}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      className="flex-1 resize-none rounded-2xl border bg-background px-4 py-2 text-sm
                 focus:outline-none focus:ring-2 focus:ring-primary max-h-24 overflow-y-auto"
    />
  );
}
```

The `Enter` key sends; `Shift+Enter` inserts a newline.

---

### Error State & Retry

Track a `failedMessage` ref. On error, render a styled error bubble with a retry button that re-sends the last user message:

```tsx
{message.isError && (
  <button
    onClick={() => retrySend(message)}
    className="text-xs text-destructive hover:underline mt-1"
  >
    Retry
  </button>
)}
```

---

### Online / Offline Status Dot

Poll `/api/chatbot/health` (which proxies to `/health`) every 60 seconds on mount. Show a green dot in the header when healthy, amber when unreachable:

```tsx
const [online, setOnline] = useState<boolean | null>(null);

useEffect(() => {
  const check = () =>
    fetch("/api/chatbot/health")
      .then((r) => setOnline(r.ok))
      .catch(() => setOnline(false));
  check();
  const interval = setInterval(check, 60_000);
  return () => clearInterval(interval);
}, []);
```

Add a `/health` proxy in `frontend/app/api/chatbot/health/route.ts`.

---

### Implementation Checklist

- [x] **6.1** Add `session_id` to `ChatResponse` in `chatbot-service/main.py`
- [x] **6.2** Install `react-markdown` and `remark-gfm`
- [x] **6.3** Add `/api/chatbot/health` proxy route
- [x] **6.4** Refactor `ChatbotWidget.tsx`:
  - [x] Replace `<input>` with auto-resize `<textarea>`
  - [x] Responsive layout (full-screen mobile, fixed-panel desktop)
  - [x] Render `MarkdownContent` for assistant messages
  - [x] Show `ConfidenceBadge` when `confidence` is present
  - [x] Show `NoteWarning` pill when `note` is present
  - [x] Show `SourceCitations` collapsible when `sources.length > 0`
  - [x] Show `SuggestionChips` when only the welcome message exists
  - [x] Add copy-to-clipboard on assistant bubbles
  - [x] Error bubble with retry button
  - [x] Online/offline status dot in header
  - [x] Read `session_id` from `/chat` response (no longer only from `/session`)
  - [x] Smart auto-scroll (pause when user scrolls up)

---

### Files Changed in Phase 6

| File | Change |
|---|---|
| `chatbot-service/main.py` | Add `session_id` to `ChatResponse`; echo it from `/chat` |
| `frontend/app/api/chatbot/health/route.ts` | New — proxies `GET /health` from chatbot service |
| `frontend/components/chatbot/ChatbotWidget.tsx` | Full rewrite of the UI layer |
| `package.json` | Add `react-markdown`, `remark-gfm` |
