# Explain-Analytics Enhancement Plan

This document describes seven targeted enhancements to the RAG-based explain-analytics service,
ordered by implementation phase. Each phase is self-contained and can be merged independently.

---

## Current State (baseline)

| Layer | What exists |
|---|---|
| Vector store | Qdrant `epilink_rag` — one point per document, dense (768-dim, `text-embedding-004`) + sparse (BM25 via fastembed) |
| Retrieval | `_hybrid_search` → Qdrant RRF → `_apply_recency_decay` → top-5 docs |
| Query construction | `_build_query` in `rag_service.py:441` — signal thresholds → keyword string |
| Generation | Rule-based fallback → Gemini `gemini-2.0-flash` with injected doc excerpts |
| Chat agent | `AgenticInsightService` with 12 tools + `search_knowledge_base` |
| Session | Redis-backed, auto-compression at 10 turns |

Key files:
- `explain-analytics/src/explain_analytics/services/rag_service.py`
- `explain-analytics/src/explain_analytics/services/insight_service.py`
- `explain-analytics/src/explain_analytics/services/knowledge_seeder.py`
- `explain-analytics/src/explain_analytics/config.py`
- `explain-analytics/src/explain_analytics/models.py`

---

## Phase 1 — SHAP-Driven Query Construction ✅ DONE

**Goal:** Make retrieval aware of what the ML model actually found important, not just
fixed signal thresholds.

**Problem today:** `_build_query` (rag_service.py:441) uses hardcoded thresholds
(`rainfall >= 80`, `temp >= 28`, `wow >= 15`). If SHAP values are available and show
that `vector_index` is the dominant driver at 45%, the query does not reflect this —
the retrieval is under-informed.

**What to change:**

### 1.1 — Pass `feature_importances` into `retrieve()`

`rag_service.py` — `retrieve()` signature (line 61):
```python
# Before
def retrieve(self, district, model_risk_score, rainfall_mm_7d, temperature_c_7d,
             wow_case_change_pct, top_k=None)

# After
def retrieve(self, district, model_risk_score, rainfall_mm_7d, temperature_c_7d,
             wow_case_change_pct, top_k=None, feature_importances=None)
```

Pass it through to `_build_query`:
```python
query = self._build_query(
    district, model_risk_score, rainfall_mm_7d, temperature_c_7d,
    wow_case_change_pct, feature_importances=feature_importances
)
```

### 1.2 — Rewrite `_build_query` to use SHAP weights

`rag_service.py:441` — replace the current method:

```python
_SHAP_FEATURE_TERMS: dict[str, str] = {
    "rainfall_mm_7d":       "rainfall standing water Aedes breeding site elimination",
    "temperature_c_7d":     "high temperature vector control mosquito lifecycle acceleration",
    "wow_case_change_pct":  "rapid case surge outbreak early warning emergency response",
    "recent_case_count":    "high case burden hospital capacity active surveillance",
    "vector_index":         "mosquito vector index larval density Aedes control",
    "humidity_pct":         "humidity mosquito survival rate vector abundance",
    "population_density":   "urban density crowded housing community intervention",
    "lag_1w_cases":         "lagged transmission incubation period case forecasting",
}

def _build_query(self, district, model_risk_score, rainfall_mm_7d,
                 temperature_c_7d, wow_case_change_pct,
                 feature_importances=None) -> str:
    risk = _risk_label(model_risk_score)
    base = f"dengue {risk} risk {district} district Sri Lanka intervention response"
    parts = [base]

    if feature_importances:
        # Sort by descending SHAP magnitude; repeat terms proportional to weight
        sorted_fi = sorted(feature_importances.items(), key=lambda x: x[1], reverse=True)
        for feat, importance in sorted_fi[:5]:
            if importance < 0.05:
                break
            terms = _SHAP_FEATURE_TERMS.get(feat)
            if terms:
                # High-importance features appear twice (stronger semantic signal)
                repeat = 2 if importance >= 0.25 else 1
                parts.extend([terms] * repeat)
    else:
        # Original threshold-based fallback
        if rainfall_mm_7d is not None and rainfall_mm_7d >= 80:
            parts.append("heavy rainfall standing water Aedes breeding site elimination")
        if temperature_c_7d is not None and temperature_c_7d >= 28:
            parts.append("high temperature vector control mosquito lifecycle acceleration")
        if wow_case_change_pct is not None and wow_case_change_pct >= 15:
            parts.append("rapid case surge outbreak early warning emergency response protocol")
        if risk in ("high", "critical"):
            parts.append("fogging fumigation rapid response team hospital preparedness")

    return " ".join(parts)
```

### 1.3 — Thread `feature_importances` from `insight_service.py`

`insight_service.py:624` — in `generate_insight()`:
```python
doc_refs = rag_service.retrieve(
    district=payload.district,
    model_risk_score=sig.model_risk_score,
    rainfall_mm_7d=sig.rainfall_mm_7d,
    temperature_c_7d=sig.temperature_c_7d,
    wow_case_change_pct=sig.wow_case_change_pct,
    feature_importances=sig.feature_importances or None,  # new
)
```

**Config changes:** None required.

**Testing:** Send a request with `feature_importances: {"vector_index": 0.45, "rainfall_mm_7d": 0.30}`
and confirm the retrieved docs are more vector-control-focused than with rainfall-heavy signals.

---

## Phase 2 — Document Chunking with Parent Reference

**Goal:** Improve retrieval precision by indexing paragraph-level chunks rather than full documents.

**Problem today:** Each of the 25 knowledge documents is a single Qdrant point with content
truncated to 800 chars at retrieval time (`rag_service.py:351`). A question about "dengue
warning signs" retrieves a full "Clinical Presentation" doc when only one paragraph is relevant.

**What to change:**

### 2.1 — Add `chunk_index` and `parent_id` to Qdrant payloads

New payload schema per chunk point:
```
{
  "title":         str,         # parent document title
  "source":        str,
  "published_date": str | None,
  "source_type":   str,
  "content":       str,         # the chunk text (300–400 tokens)
  "parent_id":     str,         # MD5 UUID of the full document
  "chunk_index":   int,         # 0-based position within parent
  "total_chunks":  int,
}
```

### 2.2 — Add `chunk_text()` helper to `rag_service.py`

```python
_CHUNK_SIZE = 350       # tokens ≈ characters / 4
_CHUNK_OVERLAP = 60    # overlapping tokens for context continuity

def _chunk_text(self, text: str) -> list[str]:
    words = text.split()
    chunks, i = [], 0
    while i < len(words):
        chunk = " ".join(words[i : i + _CHUNK_SIZE])
        chunks.append(chunk)
        i += _CHUNK_SIZE - _CHUNK_OVERLAP
    return chunks if chunks else [text]
```

### 2.3 — New `ingest_chunked()` method in `rag_service.py`

```python
def ingest_chunked(self, documents: list[RagIngestDocument], source_type: str = "knowledge") -> int:
    from qdrant_client.models import PointStruct

    client = self._client or QdrantClient(url=settings.qdrant_url)
    self._ensure_collection(client)
    sparse_model = self._sparse_model or self._load_sparse_model(return_model=True)

    stored = 0
    for doc in documents:
        parent_id = _point_id(doc.title, doc.source, doc.published_date)
        chunks = self._chunk_text(doc.content)
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
                    vector={_DENSE_VECTOR_NAME: dense_vec, _SPARSE_VECTOR_NAME: sparse_vec},
                    payload={
                        "title": doc.title,
                        "source": doc.source,
                        "published_date": doc.published_date,
                        "content": chunk,
                        "source_type": source_type,
                        "parent_id": parent_id,
                        "chunk_index": idx,
                        "total_chunks": len(chunks),
                    },
                )],
            )
            stored += 1
    return stored
```

### 2.4 — Update `KnowledgeSeeder` to call `ingest_chunked`

`knowledge_seeder.py:1140` — in `seed()`:
```python
# Before
count = rag_service.ingest_with_source_type(documents, source_type="knowledge")

# After
count = rag_service.ingest_chunked(documents, source_type="knowledge")
```

### 2.5 — Update excerpt rendering in `_hybrid_search` and `_filtered_hybrid_search`

The `excerpt` field in `DocumentReference` should now use the full chunk content (no truncation
needed since chunks are already 300-400 tokens):
```python
# Before (rag_service.py:351)
excerpt=r.payload["content"][:600],

# After
excerpt=r.payload["content"],   # chunks are already ≤400 tokens
```

**Migration note:** When switching to chunked storage, the collection must be re-seeded.
Call `POST /v1/rag/seed?force=true` after deploying this phase.

**Config changes:** Optionally expose chunk size:
```python
# config.py
rag_chunk_size: int = 350
rag_chunk_overlap: int = 60
```

---

## Phase 3 — Source-Type Aware Contextual Filtering ✅ DONE

**Goal:** Match query intent to document type so surveillance data does not pollute
guideline retrieval and vice versa.

**Problem today:** `retrieve()` calls `_hybrid_search` with no filter. A high-risk
district query may surface stale surveillance case-count documents when clinical
intervention guidelines would be more useful.

**What to change:**

### 3.1 — Add `_infer_query_intent()` to `rag_service.py`

```python
_CLINICAL_KEYWORDS = frozenset([
    "treatment", "fluid", "hospital", "warning signs", "platelet", "clinical",
    "management", "diagnosis", "NS1", "PCR", "lab", "serology", "vaccine",
    "dengvaxia", "symptoms", "DHF", "DSS", "shock", "pregnancy",
])
_SURVEILLANCE_KEYWORDS = frozenset([
    "cases", "outbreak", "trend", "week", "count", "surge", "WoW",
    "district", "report", "notification", "cluster", "spread",
])

def _infer_query_intent(self, query: str) -> str | None:
    """Return 'knowledge', 'surveillance', or None (search all)."""
    lower = query.lower()
    clinical_hits = sum(1 for k in _CLINICAL_KEYWORDS if k in lower)
    surveillance_hits = sum(1 for k in _SURVEILLANCE_KEYWORDS if k in lower)
    if clinical_hits >= 2 and clinical_hits > surveillance_hits:
        return "knowledge"
    if surveillance_hits >= 2 and surveillance_hits > clinical_hits:
        return "surveillance"
    return None
```

### 3.2 — Apply intent filter in `retrieve_for_query()`

`rag_service.py:91` — when no explicit `source_type` is passed:
```python
def retrieve_for_query(self, query, top_k=None, source_type=None):
    k = top_k or settings.rag_top_k
    effective_source_type = source_type or self._infer_query_intent(query)
    try:
        if effective_source_type:
            results = self._filtered_hybrid_search(query, k, effective_source_type)
            # Fall back to unfiltered if filtered returns nothing
            if not results:
                results = self._hybrid_search(query, k)
        elif settings.rag_retrieval_mode == "dense":
            results = self._dense_search(self._embed_dense(query), k)
        elif settings.rag_retrieval_mode == "sparse":
            results = self._sparse_search(self._embed_sparse(query), k)
        else:
            results = self._hybrid_search(query, k)
        return self._apply_recency_decay(results)
    except Exception as exc:
        print(f"[RAGService] retrieve_for_query failed: {exc}")
        return []
```

### 3.3 — Apply intent filter in `retrieve()` for structured signals

For structured signal queries, `source_type` should prefer `"surveillance"` when the
risk is high/critical (recent case data is most actionable) and `"knowledge"` when
low/moderate (guidelines and prevention matter more):

```python
def retrieve(self, district, model_risk_score, ...):
    k = top_k or settings.rag_top_k
    query = self._build_query(...)
    risk = _risk_label(model_risk_score)
    # High-stakes queries: blend both types; always fall back if empty
    preferred = "surveillance" if risk in ("high", "critical") else None
    try:
        if preferred:
            results = self._filtered_hybrid_search(query, k, preferred)
            if len(results) < 2:           # not enough — search all
                results = self._hybrid_search(query, k)
        else:
            results = self._hybrid_search(query, k)
        return self._apply_recency_decay(results)
    except Exception as exc:
        print(f"[RAGService] retrieve failed: {exc}")
        return []
```

**Config changes:** None required.

---

## Phase 4 — Source-Type Tuned Recency Decay ✅ DONE

**Goal:** Surveillance documents should go stale in days; clinical guidelines should
stay relevant for years. The current uniform λ=0.001 conflates both.

**Problem today:** `_apply_recency_decay` (rag_service.py:399) applies the same
exponential decay constant regardless of `source_type`. A 6-month-old WHO dengue
guideline suffers the same penalty as 6-month-old case count data, even though the
guideline is still fully valid.

**What to change:**

### 4.1 — Add per-source λ constants to `config.py`

```python
# config.py — add inside Settings class
rag_recency_decay_lambda: float = 0.001          # default (existing)
rag_recency_decay_surveillance: float = 0.05     # ~14-day half-life
rag_recency_decay_knowledge: float = 0.0001      # ~19-year half-life
rag_recency_decay_guideline: float = 0.0003      # ~6-year half-life
```

### 4.2 — Pass `source_type` through `DocumentReference`

`models.py` — add optional field to `DocumentReference`:
```python
class DocumentReference(BaseModel):
    title: str
    source: str
    published_date: str | None = None
    excerpt: str
    relevance_score: float | None = None
    source_type: str | None = None     # new
    chunk_index: int | None = None     # new (from Phase 2)
```

### 4.3 — Populate `source_type` in all `_*_search` methods

In every `DocumentReference(...)` constructor inside `_hybrid_search`,
`_filtered_hybrid_search`, `_dense_search`, and `_sparse_search`:
```python
source_type=r.payload.get("source_type"),
```

### 4.4 — Rewrite `_apply_recency_decay` to use per-source λ

```python
_DECAY_BY_SOURCE: dict[str, str] = {
    "surveillance": "rag_recency_decay_surveillance",
    "knowledge":    "rag_recency_decay_knowledge",
    "guideline":    "rag_recency_decay_guideline",
}

def _apply_recency_decay(self, docs: list[DocumentReference]) -> list[DocumentReference]:
    default_lam = settings.rag_recency_decay_lambda
    today = date.today()
    decayed: list[tuple[float, DocumentReference]] = []

    for doc in docs:
        raw = doc.relevance_score if doc.relevance_score is not None else 1.0
        lam_key = _DECAY_BY_SOURCE.get(doc.source_type or "", "")
        lam = getattr(settings, lam_key, default_lam)

        if doc.published_date and lam > 0:
            try:
                pub = datetime.strptime(doc.published_date, "%Y-%m-%d").date()
                days = max((today - pub).days, 0)
                adjusted = raw * math.exp(-lam * days)
            except ValueError:
                adjusted = raw
        else:
            adjusted = raw

        decayed.append((adjusted, doc))

    decayed.sort(key=lambda x: x[0], reverse=True)
    return [
        DocumentReference(
            title=d.title, source=d.source, published_date=d.published_date,
            excerpt=d.excerpt, relevance_score=round(score, 3),
            source_type=d.source_type, chunk_index=d.chunk_index,
        )
        for score, d in decayed
        if score >= _MIN_RELEVANCE_SCORE
    ]
```

---

## Phase 5 — HyDE Query Expansion (Hypothetical Document Embeddings)

**Goal:** Improve semantic recall for edge-case and under-represented district conditions by
generating a hypothetical relevant document before embedding, rather than embedding the raw
signal string.

**Problem today:** `_build_query` produces a keyword-bag like:
`"dengue critical risk Colombo Sri Lanka rapid case surge heavy rainfall..."`.
This is lexically clear but semantically shallow — the embedding captures the query intent
less precisely than if it were written in the same voice as the knowledge documents.

**How HyDE works:**
1. Send the query context to Gemini as a cheap, low-temperature call.
2. Ask it to write a short (2–3 sentence) *hypothetical excerpt* from a dengue guideline
   that would be relevant to this situation.
3. Embed the hypothetical text instead of (or averaged with) the raw query.
4. Search using the richer embedding.

**What to change:**

### 5.1 — Add `EXPLAIN_RAG_HYDE_ENABLED` to `config.py`

```python
rag_hyde_enabled: bool = False   # opt-in; incurs one extra Gemini call per insight
```

### 5.2 — Add `_expand_query_with_hyde()` to `rag_service.py`

```python
_HYDE_PROMPT = """\
You are a dengue epidemiology expert. Write a 2–3 sentence excerpt from a \
Ministry of Health dengue risk management guideline that would be the MOST \
relevant document for the following situation. Do not mention the district name. \
Write only the guideline text, no preamble.

Situation: {query}
"""

def _expand_query_with_hyde(self, query: str) -> str:
    """Return a hypothetical guideline excerpt for the query, or the query itself on failure."""
    if not settings.gemini_api_key:
        return query
    try:
        from google import genai
        client = genai.Client(api_key=settings.gemini_api_key)
        response = client.models.generate_content(
            model=settings.llm_model,
            contents=[{"role": "user", "parts": [{"text": _HYDE_PROMPT.format(query=query)}]}],
            config={"temperature": 0.1, "max_output_tokens": 150},
        )
        hypothesis = (response.text or "").strip()
        if len(hypothesis) > 30:
            # Average the original query embedding with the hypothesis embedding
            return hypothesis
        return query
    except Exception as exc:
        print(f"[RAGService] HyDE expansion failed: {exc}")
        return query
```

### 5.3 — Integrate HyDE into `_hybrid_search`

```python
def _hybrid_search(self, query: str, top_k: int) -> list[DocumentReference]:
    from qdrant_client.models import FusionQuery, Prefetch

    effective_query = (
        self._expand_query_with_hyde(query)
        if settings.rag_hyde_enabled
        else query
    )

    dense_vec = self._embed_dense(effective_query)
    sparse_vec = self._embed_sparse(query)   # BM25 stays on original keywords
    ...
```

Note: sparse BM25 should use the **original** query (keywords are exact), while the
dense embedding benefits from the HyDE expansion.

**Cost:** One extra `gemini-2.0-flash` call per `retrieve()` invocation (≈ 150 output tokens).
Enable only when latency budget allows. Disable by default.

---

## Phase 6 — Cross-Encoder Re-Ranking

**Goal:** Improve the final ranked list quality by scoring each retrieved chunk against
the full epidemiological context, not just vector similarity.

**Problem today:** RRF fuses two independent single-vector signals. Neither signal sees
the *combination* of district + risk level + SHAP drivers when scoring individual documents.
A re-ranker sees the full context and can demote a high-vector-score doc that is actually
about a different transmission scenario.

**What to change:**

### 6.1 — Add `EXPLAIN_RAG_RERANK_ENABLED` to `config.py`

```python
rag_rerank_enabled: bool = False       # opt-in; costs one Gemini call per batch
rag_rerank_top_n: int = 5              # final docs to keep after re-ranking
rag_rerank_candidate_k: int = 12       # retrieve this many candidates before re-ranking
```

### 6.2 — Add `_rerank_with_gemini()` to `rag_service.py`

```python
_RERANK_PROMPT = """\
You are a document relevance judge for dengue risk analysis.

Situation: {context}

For each document below, output ONLY a JSON array of objects with "idx" (0-based) \
and "score" (0.0–1.0, how useful this document is for the situation above). \
No explanation, only valid JSON.

Documents:
{docs}
"""

def _rerank_with_gemini(
    self, query: str, docs: list[DocumentReference], top_n: int
) -> list[DocumentReference]:
    """Re-rank docs using a Gemini relevance judgement call."""
    if not docs or not settings.gemini_api_key:
        return docs[:top_n]
    try:
        from google import genai
        doc_block = "\n".join(
            f"[{i}] {d.title}: {d.excerpt[:300]}"
            for i, d in enumerate(docs)
        )
        prompt = _RERANK_PROMPT.format(context=query, docs=doc_block)
        client = genai.Client(api_key=settings.gemini_api_key)
        response = client.models.generate_content(
            model=settings.llm_model,
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
            config={"response_mime_type": "application/json", "temperature": 0.0},
        )
        scores = json.loads(response.text or "[]")
        scored = {int(item["idx"]): float(item["score"]) for item in scores}
        reranked = sorted(range(len(docs)), key=lambda i: scored.get(i, 0.0), reverse=True)
        return [
            DocumentReference(
                title=docs[i].title, source=docs[i].source,
                published_date=docs[i].published_date, excerpt=docs[i].excerpt,
                relevance_score=round(scored.get(i, docs[i].relevance_score or 0), 3),
                source_type=docs[i].source_type,
            )
            for i in reranked[:top_n]
        ]
    except Exception as exc:
        print(f"[RAGService] re-rank failed: {exc}")
        return docs[:top_n]
```

### 6.3 — Integrate into `retrieve()` and `retrieve_for_query()`

```python
# At the end of retrieve(), before returning:
if settings.rag_rerank_enabled and len(results) > settings.rag_rerank_top_n:
    results = self._rerank_with_gemini(query, results, settings.rag_rerank_top_n)
    return results

return results[:settings.rag_top_k]
```

Also update the initial candidate count when re-ranking is enabled:
```python
k = (settings.rag_rerank_candidate_k if settings.rag_rerank_enabled
     else (top_k or settings.rag_top_k))
```

**Cost:** One Gemini call per insight request when enabled. Keep disabled by default
for low-latency paths; enable for high-stakes (`critical` risk) districts only if desired.

---

## Phase 7 — Relevance Feedback Loop

**Goal:** Continuously improve retrieval quality by capturing user signals on whether
retrieved documents were actually useful.

**Problem today:** There is no signal path from "was this document helpful?" back into
the retrieval system. Over time, poorly-ranked documents remain ranked the same way.

**What to change:**

### 7.1 — Add `feedback_score` to Qdrant payload

When a document is upvoted/downvoted, update its Qdrant point payload:
```
payload["feedback_positive"] = int   # cumulative upvotes
payload["feedback_negative"] = int   # cumulative downvotes
payload["feedback_ratio"]   = float  # positive / (positive + negative)
```

### 7.2 — Add feedback endpoint in `main.py`

```python
class DocumentFeedbackRequest(BaseModel):
    point_id: str           # Qdrant point UUID (returned in DocumentReference)
    vote: Literal["up", "down"]
    session_id: str | None = None

@app.post("/v1/rag/feedback")
async def submit_document_feedback(req: DocumentFeedbackRequest):
    rag_service.record_feedback(req.point_id, req.vote)
    return {"status": "recorded"}
```

### 7.3 — Add `record_feedback()` and `point_id` to `rag_service.py`

Expose `point_id` on `DocumentReference` (add field to `models.py`):
```python
class DocumentReference(BaseModel):
    ...
    point_id: str | None = None   # Qdrant point UUID for feedback
```

Populate in all `_*_search` methods:
```python
point_id=str(r.id),
```

Feedback method:
```python
def record_feedback(self, point_id: str, vote: str) -> None:
    if not self._ready:
        return
    try:
        points = self._client.retrieve(
            collection_name=settings.qdrant_collection,
            ids=[point_id], with_payload=True,
        )
        if not points:
            return
        payload = points[0].payload or {}
        pos = payload.get("feedback_positive", 0)
        neg = payload.get("feedback_negative", 0)
        if vote == "up":
            pos += 1
        else:
            neg += 1
        ratio = pos / (pos + neg) if (pos + neg) > 0 else 0.5
        self._client.set_payload(
            collection_name=settings.qdrant_collection,
            payload={"feedback_positive": pos, "feedback_negative": neg,
                     "feedback_ratio": round(ratio, 3)},
            points=[point_id],
        )
    except Exception as exc:
        print(f"[RAGService] record_feedback failed: {exc}")
```

### 7.4 — Apply feedback ratio as a score multiplier in `_apply_recency_decay`

After computing the decay-adjusted score:
```python
feedback_ratio = doc_payload.get("feedback_ratio", 0.5)  # neutral default
# Amplify well-rated docs, penalise poorly-rated ones (±20% max)
feedback_multiplier = 0.8 + 0.4 * feedback_ratio
adjusted = adjusted * feedback_multiplier
```

Since `DocumentReference` doesn't carry raw payload, store the feedback ratio
either in a separate payload field on the Qdrant point or pass it through the
search result's score directly when populating the object.

**Note:** Feedback data accumulates gradually. The multiplier has no effect until
at least one vote has been recorded (`feedback_ratio` defaults to 0.5 → multiplier = 1.0).

---

## Implementation Order & Effort Estimates

| Phase | Enhancement | Effort | Risk | Value |
|---|---|---|---|---|
| 1 | SHAP-driven query construction | ✅ Done | Low | High — immediate recall improvement |
| 2 | Document chunking | Medium (2 days) | Medium (requires re-seed) | High — most impactful for precision |
| 3 | Source-type contextual filtering | ✅ Done | Low | Medium — guards against cross-contamination |
| 4 | Per-source recency decay | ✅ Done | Low | Medium — prevents old surveillance from polluting |
| 5 | HyDE query expansion | Low (1 day) | Low (opt-in flag) | Medium — best for edge-case district scenarios |
| 6 | Cross-encoder re-ranking | Medium (1.5 days) | Low (opt-in flag) | Medium — precision lift on critical-risk queries |
| 7 | Relevance feedback loop | Medium (2 days) | Low | Long-term — compounding value over time |

**Recommended delivery order:** Phase 1 → 4 → 3 → 2 → 5 → 6 → 7

Phases 1 and 4 are pure code changes with no data migration. Phase 2 requires a one-time
re-seed of the Qdrant collection. Phases 5 and 6 are opt-in via config flags and can be
tested in staging before enabling in production.

---

## Configuration Reference (all new keys)

Add to `config.py` inside `Settings`:

```python
# Phase 1 — no new config needed

# Phase 2 — chunking
rag_chunk_size: int = 350
rag_chunk_overlap: int = 60

# Phase 4 — per-source decay
rag_recency_decay_surveillance: float = 0.05
rag_recency_decay_knowledge: float = 0.0001
rag_recency_decay_guideline: float = 0.0003

# Phase 5 — HyDE
rag_hyde_enabled: bool = False

# Phase 6 — re-ranking
rag_rerank_enabled: bool = False
rag_rerank_top_n: int = 5
rag_rerank_candidate_k: int = 12
```

Corresponding `.env` keys use the `EXPLAIN_` prefix:
```
EXPLAIN_RAG_CHUNK_SIZE=350
EXPLAIN_RAG_CHUNK_OVERLAP=60
EXPLAIN_RAG_RECENCY_DECAY_SURVEILLANCE=0.05
EXPLAIN_RAG_RECENCY_DECAY_KNOWLEDGE=0.0001
EXPLAIN_RAG_RECENCY_DECAY_GUIDELINE=0.0003
EXPLAIN_RAG_HYDE_ENABLED=false
EXPLAIN_RAG_RERANK_ENABLED=false
EXPLAIN_RAG_RERANK_TOP_N=5
EXPLAIN_RAG_RERANK_CANDIDATE_K=12
```
