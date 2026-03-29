# Explainable AI (XAI) for EpiLink Analytics

Adding an "Explainable Insights" feature using an LLM / RAG-based approach is an **excellent and highly impactful idea**. Often, analytical dashboards displaying complex ML predictions (like EpiLink's DS-level XGBoost/LightGBM ensemble outputs) are difficult for non-technical stakeholders (e.g., Medical Officers of Health) to interpret and translate into action.

By integrating a RAG (Retrieval-Augmented Generation) system, you can bridge the gap between "raw prediction metrics" and "actionable public health interventions."

---

## Why This Feature is Valuable

1. **Democratizes Data**: Translates complex ML outputs (quantile regressions, uncertainty bounds) into plain-language summaries (e.g., "Colombo has a high predicted outbreak risk next week primarily due to recent heavy rainfall and a 15% WoW increase in reported cases.").
2. **Context-Aware Recommendations**: By feeding historical data and established Ministry of Health guidelines into the RAG, the system can recommend specific resource allocations (e.g., "Deploy fogging teams to Zone A").
3. **Trust and Transparency**: Explainable AI (XAI) builds trust. If a user understands _why_ the model made a prediction, they are more likely to act on it.

---

## Target Architecture

The following is the production-grade RAG pipeline planned for the `explain-analytics` service:

```
[PostgreSQL] ──┐
               ├──> [FastAPI ETL Layer]  ←── Automated weekly scheduler
[Weather API] ─┘          │
                           ↓
              [Text + Insight Generation]
              (structured weekly records → embeddable text)
                           │
                           ↓
                   [Embedding Model]
                (Google text-embedding-004, 768-dim)
                           │
                           ↓
                   [Qdrant Vector DB]
            (HNSW index, payload filters, snapshots)
                           │
                           ↓
         [Retriever — Hybrid + Time-aware]
         (BM25 keyword + vector cosine, RRF fusion,
          recency decay on publication date)
                           │
                           ↓
           [LLM — Gemini 2.0 Flash (Explainable Prompt)]
           (grounded in retrieved MoH documents)
                           │
                           ↓
            [Admin Dashboard Insights / Chat]
```

### Component Responsibilities

| Component | Technology | Role |
|---|---|---|
| Data Sources | PostgreSQL + NestJS Analytics API | Weekly case counts, weather, ML predictions |
| ETL Layer | FastAPI + APScheduler | Auto-pulls, transforms to embeddable text, upserts |
| Embedding Model | Google `text-embedding-004` (768-dim) | Dense vector representation |
| Vector DB | **Qdrant** (HNSW, payload filtering) | Stores and searches document vectors |
| Retriever | Hybrid BM25 + vector, RRF fusion, time-decay | Precision + recall + recency |
| LLM | Gemini 2.0 Flash | Grounded narrative generation |
| Interface | FastAPI → NestJS → React Admin | Insight cards, chat, national reports |

### Why Qdrant over pgvector

The current implementation uses pgvector (PostgreSQL extension) which works for a prototype but has limitations at production scale:

| Capability | pgvector | Qdrant |
|---|---|---|
| Index type | IVFFlat | HNSW (faster, more accurate) |
| Payload filtering | None | Native (filter by district, date, source) |
| Quantization | None | Scalar + product quantization |
| Backup / snapshots | Manual | Built-in REST snapshots |
| Hybrid search | Manual | Built-in sparse + dense fusion |
| Sharding | None | Built-in horizontal scaling |

Qdrant enables filtered retrieval — e.g., "retrieve only documents relevant to Colombo district published after 2023" — which is critical for grounding insights in geographically and temporally relevant context.

### 3. The Interface (Frontend - React/React Native)

- **Insight Cards**: Display brief, human-readable insights next to complex charts.
- **"Explain This" Button**: A tooltip or modal that users can click to get a natural language breakdown of a specific chart or prediction.
- **Interactive Chat**: A specialized chat interface where users can ask questions like, "What were the most effective actions taken during the similar 2024 outbreak?"

---

## Implementation Phasing

### Phase 1: Structured Data to Text — COMPLETED

- Feed the latest JSON payload of predictions and historical data directly into the Gemini LLM (`gemini-2.0-flash`).
- Rule-based fallback generates deterministic insights when the LLM is unavailable.
- **Delivered**:
  - `POST /v1/insights/explain` endpoint with `ExplainInsightResponse` (risk level, summary, key drivers, recommendations, caveats, confidence score, trend direction).
  - 4-tier risk classification (low / moderate / high / critical) with epidemiologically-grounded thresholds.
  - Signal-completeness confidence scoring and uncertainty range passthrough.
  - Sri Lanka-specific system prompt (monsoon seasons, vector biology, MoH alert thresholds).

### Phase 2: RAG Pipeline — COMPLETED (pgvector baseline)

- `rag_service.py` implements semantic retrieval over a pgvector-backed `rag_documents` table using Google `text-embedding-004` (768-dim) with cosine similarity (threshold 0.55, top-5).
- Query is constructed from district signals (risk level, rainfall, temperature, WoW change) and appended to the LLM prompt as "MoH Reference Documents."
- Manual ingestion via `POST /v1/rag/ingest`; corpus status via `GET /v1/rag/status`.
- **Goal achieved**: The LLM cites retrieved MoH documents in recommendations.
- **Next**: migrate to Qdrant with hybrid retrieval and automated ETL (see Enhancements 12–15 below).

### Phase 3: Agentic Workflows — COMPLETED (baseline)

- Agno agent with 6 analytics tools (compare districts, year-over-year, weather correlation, outbreak alerts, growth rate, district details).
- `POST /v1/insights/chat` endpoint with session ID tracking and tool call provenance.
- **Goal**: Users can ask free-form questions and the agent fetches live data before answering.

---

## Planned Enhancements

The following enhancements are prioritised by impact and effort. Each section describes the current gap, the change required, and the expected outcome.

---

### Enhancement 1 — SHAP / Feature Importance in Key Drivers (Priority: Critical)

**Gap**: The service receives a single `model_risk_score` float. It has no visibility into which input features (rainfall, temperature, case trend, etc.) drove that score in the XGBoost/LightGBM ensemble. Key drivers are currently inferred heuristically from thresholds, not from the model itself.

**Change**:
- Add `feature_importances: dict[str, float]` to `StructuredSignals` — populated by the ML pipeline and forwarded via NestJS.
- Use SHAP values (or SHAP-equivalent feature attribution from the ensemble) as the authoritative source for `key_drivers` generation.
- LLM prompt includes the ranked feature importances so the generated text reflects real model internals (e.g., "Rainfall contributes 42% of predicted risk; temperature contributes 31%").

**Outcome**: The "Explainable" in Explainable Analytics refers to the model's actual decision logic, not a post-hoc narrative.

---

### Enhancement 2 — Complete Phase 2 RAG Pipeline (Priority: Critical)

**Gap**: `rag_context` is accepted as a plain list of strings passed in by the caller. No document retrieval happens inside the service. `references` in the response simply echoes the first 3 input strings with no source metadata.

**Change**:
- Integrate `pgvector` retrieval directly in `insight_service.py` using the district name, risk score, and weather signals as the query embedding.
- Corpus: MoH dengue SOPs, post-outbreak reports, seasonal advisories, successful past interventions.
- Return structured `references` with document title, publication date, and source organisation.
- LLM prompt receives the top-K retrieved chunks alongside structured signals.

**Outcome**: Recommendations are grounded in specific, citable MoH documents rather than generic public health advice.

---

### Enhancement 3 — National Summary and Batch Explain Endpoints (Priority: High)

**Gap**: The service is entirely request-driven — a user must query one district at a time. There is no national-level narrative or batch processing capability.

**Change**:
- `GET /v1/insights/national-summary`: fetches all district signals, synthesises a 3-paragraph executive-level situation report, flags any districts that crossed outbreak thresholds in the last 7 days.
- `POST /v1/insights/batch-explain`: accepts a list of district requests and returns an array of `ExplainInsightResponse` objects in a single call, used for automated weekly situation reports.
- Include a `URGENT:` prefix in summaries when `model_risk_score >= 0.85`.

**Outcome**: Administrators get a single-request, printable national situation report; reduces frontend round-trips for multi-district dashboards.

---

### Enhancement 4 — Expanded Agent Tool Library (Priority: High)

**Gap**: The 6 current tools return pre-aggregated summaries. Several analytical questions cannot be answered: seasonal patterns, geographic spread, past interventions, and model performance.

**New tools to add**:

| Tool | Data Source | Unlocks |
|------|------------|---------|
| `get_seasonal_pattern(district, years)` | Timeseries endpoint | Week-by-week multi-year overlay to identify seasonal peaks and anomalies |
| `get_cross_district_spillover(district)` | Compare endpoint + adjacency map | Neighboring district trends to assess geographic spread risk |
| `get_intervention_history(district)` | New NestJS endpoint | Log of past fogging campaigns, source-reduction drives, and outcomes |
| `get_model_performance_metrics(district)` | ML pipeline metrics endpoint | Model accuracy / recall for the last N weeks to qualify predictions |
| `get_demographic_hotspots(district)` | MOH zone / GND-level data | Sub-district case distribution to guide targeted interventions |

**Outcome**: The agent can answer a broader range of operational questions and provide spatially-aware recommendations.

---

### Enhancement 5 — Spatial and Geographic Cluster Analysis (Priority: High)

**Gap**: Each district is treated as independent. Dengue spreads geographically; the service has no concept of adjacency or clustering.

**Change**:
- Add `neighboring_districts: list[DistrictSignal]` to `StructuredSignals` so the LLM has adjacent district context in every insight request.
- Add cluster detection logic: flag in `key_drivers` when 3+ neighboring districts are simultaneously rising.
- Include a `spillover_risk: bool` field in `ExplainInsightResponse` when a high-burden neighbor is detected.
- Power the `get_cross_district_spillover` agent tool with a hardcoded Sri Lanka district adjacency map.

**Outcome**: Insights reflect geographic spread dynamics and can recommend inter-district coordination actions.

---

### Enhancement 6 — Meaningful Confidence and Uncertainty Representation (Priority: Medium)

**Gap**: The current `confidence_score` (0–100) is a signal-completeness counter (30 base + 14 pts per filled field). It has no semantic relationship to model uncertainty.

**Change**:
- Split into two fields:
  - `data_completeness_score` (0–100): current logic, renamed accurately.
  - `prediction_confidence` (0–100): derived from the ML model's `uncertainty_lower` / `uncertainty_upper` bounds — narrow interval = high confidence.
- Surface uncertainty in the LLM-generated `summary`: "The model predicts high risk with a 95% interval of 0.72–0.89, indicating low uncertainty."
- Add `data_freshness_warning: bool` when the latest data point is older than 7 days.

**Outcome**: Users can distinguish between "we have complete data" and "the model is certain" — two very different things.

---

### Enhancement 7 — Session Persistence for Agentic Chat (Priority: Medium)

**Gap**: `session_id` is generated but nothing is stored server-side. The entire conversation history is passed back by the client on every request, which will overflow the model context window for long sessions.

**Change**:
- Redis-backed session storage keyed by `session_id` with a 2-hour TTL.
- Server stores and appends messages; clients send only `session_id` + new user message.
- Automatic conversation summarisation after 10 turns to compress context.
- `GET /v1/insights/chat/{session_id}/history` endpoint to retrieve past exchanges.
- `DELETE /v1/insights/chat/{session_id}` to explicitly end a session.

**Outcome**: Stable multi-turn conversations without client-side history management or context overflow.

---

### Enhancement 8 — Lightweight Follow-up Question Endpoint (Priority: Medium)

**Gap**: `user_question` in `ExplainInsightRequest` allows one follow-up but re-runs the full insight pipeline (including LLM call) every time. There is no cheap path for follow-up questions on an already-generated insight.

**Change**:
- `POST /v1/insights/followup`: accepts `{ insight_id, question }` where `insight_id` is a hash of the original request.
- Cache the generated `ExplainInsightResponse` per district with a 5-minute TTL.
- Follow-up call retrieves the cached insight and passes only the cached summary + new question to the LLM — skipping all signal processing.
- Return only `follow_up_answer` (no full insight regeneration).

**Outcome**: Sub-second follow-up responses; significant reduction in Gemini API costs for interactive dashboards.

---

### Enhancement 9 — Structured Logging and Observability (Priority: Medium)

**Gap**: The service uses `print()` statements throughout. There is no structured logging, request tracing, latency tracking, or LLM fallback rate monitoring.

**Change**:
- Replace all `print()` calls with `structlog` using JSON formatter.
- Log at each decision point: Gemini call start/end with latency, fallback trigger reason, tool calls invoked in agent sessions.
- Track and expose metrics via `GET /metrics` (Prometheus format):
  - `gemini_request_duration_seconds`
  - `insight_fallback_total` (rule-based vs LLM)
  - `agent_tool_calls_total` (by tool name)
  - `rag_retrieval_duration_seconds` (once Phase 2 is complete)
- Add `request_id` to every response for end-to-end tracing with NestJS.

**Outcome**: Operational visibility into LLM reliability, tool usage patterns, and latency — necessary before production deployment.

---

### Enhancement 10 — Response Caching for Insight Stability (Priority: Medium)

**Gap**: The same district with identical data can return subtly different LLM responses on each call (even at temperature 0.2), which erodes user trust.

**Change**:
- Cache `ExplainInsightResponse` keyed on `hash(district + prediction_week + structured_signals)` with a TTL aligned to the data refresh cadence (default: 6 hours).
- Add `cached: bool` and `cached_at: datetime` to the response so the frontend can display "Insight generated 2h ago."
- Bypass cache when `user_question` is provided (personalised responses should not be cached).

**Outcome**: Consistent, stable insights within a data cycle; reduced LLM API costs.

---

### Enhancement 11 — Multi-Language Output (Priority: Medium)

**Gap**: All generated text is English-only. EpiLink's primary users are Sri Lankan public health officers for whom Sinhala and Tamil are official working languages.

**Change**:
- Add `language: "en" | "si" | "ta"` to both `ExplainInsightRequest` and `ChatRequest`.
- Append language instruction to the Gemini system prompt: "Respond entirely in [language]."
- Default to `"en"` for backward compatibility.
- Test with Gemini 2.0 Flash — it handles Sinhala and Tamil adequately at temperature 0.2.

**Outcome**: Insights are accessible to field-level public health workers without English fluency.

---

## Production-Grade RAG Pipeline (Planned)

The following enhancements implement the target architecture described above — migrating from the pgvector baseline to a fully production-grade Qdrant-backed RAG system with automated ETL and hybrid retrieval.

---

### Enhancement 12 — Migrate Vector Store to Qdrant (Priority: Critical)

**Gap**: Current `rag_service.py` uses pgvector with IVFFlat indexing. It has no payload filtering, no built-in backup strategy, and no support for hybrid sparse+dense retrieval. These limitations block the retrieval quality improvements in Enhancements 13 and 14.

**Change**:
- Replace `psycopg` pgvector logic in `rag_service.py` with `qdrant-client` (Python SDK).
- Create a Qdrant collection `epilink_rag` with:
  - Vector size: 768, distance: Cosine
  - HNSW index parameters: `m=16`, `ef_construct=100`
  - Payload schema: `{ district, source, source_type, published_date, content_preview }`
- Migrate ingestion: embed via `text-embedding-004`, upsert points with full payload into Qdrant.
- Migrate retrieval: use `qdrant_client.search()` with optional payload filters.
- Add `docker-compose` service for Qdrant (port 6333/6334) with a mounted volume for persistence.
- Environment variable: `EXPLAIN_QDRANT_URL` (default: `http://localhost:6333`), `EXPLAIN_QDRANT_COLLECTION`.

**Why Qdrant**:
- HNSW index provides significantly better ANN recall vs IVFFlat at the same latency budget.
- Payload filters enable district-scoped retrieval: only surface documents relevant to the queried district or neighbouring districts.
- Built-in REST snapshots for production backup without pg_dump complexity.
- Path to sparse+dense hybrid search (Enhancement 13) is native in Qdrant via sparse vectors.

**Outcome**: Vector store is production-grade — faster retrieval, payload-filtered queries, backup-ready, and unblocks hybrid search.

---

### Enhancement 13 — Hybrid Retrieval with BM25 + RRF Fusion (Priority: Critical)

**Gap**: Current retrieval is purely semantic (dense vector cosine similarity). This misses exact keyword matches — e.g., a query for "Colombo fogging campaign 2023" may not surface a document that literally contains those words if its embedding is not close enough. Keyword search and semantic search are complementary.

**Change**:
- Enable Qdrant's sparse vector support using BM25 via `fastembed` (Qdrant's recommended sparse encoder).
- On ingestion: generate both dense (`text-embedding-004`) and sparse (BM25 via `fastembed`) vectors per document.
- On retrieval: issue a `QueryRequest` with `prefetch` for both dense and sparse searches, then apply **Reciprocal Rank Fusion (RRF)** fusion in a single Qdrant `query` call (Qdrant 1.10+ native support).
- Configurable weight: `EXPLAIN_HYBRID_ALPHA` (0.0 = pure BM25, 1.0 = pure vector, default: 0.7).
- Add `retrieval_mode: "hybrid" | "dense" | "sparse"` to config.

**Outcome**: Retrieval combines the precision of keyword matching with the recall of semantic search — the same document corpus surfaces more relevant results for both clinical terminology queries and natural language questions.

---

### Enhancement 14 — Time-aware Retrieval with Recency Decay (Priority: High)

**Gap**: A document from 2018 and one from 2025 rank equally if their embedding similarity is the same. For dengue surveillance, recent MoH guidelines, updated SOPs, and post-outbreak reports from the last 1–2 years should rank higher than older documents.

**Change**:
- Store `published_date` as a Unix timestamp in the Qdrant point payload.
- Post-retrieval scoring: multiply raw similarity score by a time-decay factor: `score × e^(-λ × days_since_published)` where λ controls decay rate (default: `0.001`, meaning ~2-year half-life).
- Configurable: `EXPLAIN_RECENCY_DECAY_LAMBDA` env var.
- Add `published_date` to the `DocumentReference` response model so the frontend can display document age alongside citations.
- For district-specific queries: apply an additional payload filter boost — documents matching the queried district in payload get a +0.1 score bonus before decay.

**Outcome**: LLM grounds its recommendations in the most current available guidelines. Users see source dates on citations, enabling trust calibration.

---

### Enhancement 15 — Automated ETL Pipeline for RAG Corpus (Priority: High)

**Gap**: The RAG corpus is populated entirely by manual `POST /v1/rag/ingest` calls. There is no automated pipeline that continuously updates the vector store from live surveillance data. This means the RAG corpus goes stale immediately after manual ingestion and does not reflect the ongoing weekly dengue situation.

**Change**:
- Add `APScheduler` to the FastAPI service with a weekly background job (`etl_service.py`):
  1. **Fetch**: Call NestJS backend for the latest weekly district data across all 26 districts.
  2. **Transform**: Convert each district's weekly record into embeddable text:
     ```
     Week 12 2025 | Colombo | 145 cases | +22% WoW | 92mm rainfall | 29.5°C
     Risk: high. Trend: rising. Neighbours (Gampaha, Kalutara) also rising.
     ```
  3. **Embed**: Generate dense + sparse vectors via `text-embedding-004` + BM25.
  4. **Upsert**: Insert into Qdrant with payload `{ district, week, year, source: "surveillance", published_date }`. Use point IDs deterministic on `district + week + year` to avoid duplicates on re-run.
  5. **Log**: Emit structured log with counts of upserted, skipped, and failed records.
- Schedule: Every Monday at 06:00 LKT (aligned with RDHS weekly reporting cycle).
- Manual trigger endpoint: `POST /v1/rag/etl/run` (admin-only, protected by `x-internal-api-key`).
- ETL status endpoint: `GET /v1/rag/etl/status` — returns last run time, records upserted, next scheduled run.
- Separate corpus type from automated data: `source_type: "surveillance" | "guideline" | "report"` in payload, so retrieval can be filtered by corpus type.

**Outcome**: The RAG corpus stays current with weekly surveillance data automatically. The LLM can cite specific recent weeks ("In Week 11 2025, a similar pattern in Gampaha preceded a 40% case spike") rather than only static MoH documents.

---

## Enhancement Priority Summary

### Completed

| # | Enhancement | Effort | Impact | Status |
|---|------------|--------|--------|--------|
| 1 | SHAP / feature importances in key drivers | Medium | Critical | **Done** |
| 2 | RAG pipeline — pgvector baseline | High | Critical | **Done** |
| 3 | National summary + batch explain endpoints | Low | High | **Done** |
| 4 | Expanded agent tool library (5 new tools) | Medium | High | **Done** |
| 5 | Spatial / geographic cluster analysis | Medium | High | **Done** |
| 6 | Meaningful confidence and uncertainty fields | Low | Medium | **Done** |
| 7 | Session persistence for agentic chat (Redis) | Medium | Medium | **Done** |

### Planned — Production RAG Pipeline

| # | Enhancement | Effort | Impact | Status |
|---|------------|--------|--------|--------|
| 12 | Migrate vector store to Qdrant | Medium | Critical | Planned |
| 13 | Hybrid retrieval — BM25 + vector + RRF fusion | High | Critical | Planned |
| 14 | Time-aware retrieval with recency decay | Medium | High | Planned |
| 15 | Automated ETL pipeline (APScheduler) | Medium | High | Planned |

### Planned — Operational Improvements

| # | Enhancement | Effort | Impact | Status |
|---|------------|--------|--------|--------|
| 8 | Lightweight follow-up question endpoint | Low | Medium | Planned |
| 9 | Structured logging and observability | Low | Medium | Planned |
| 10 | Response caching for insight stability | Low | Medium | Planned |
| 11 | Multi-language output (Sinhala / Tamil) | Low | Medium | Planned |

---

## Quick Prototype Example (Pseudo-code for Agno)

```python
# ai_service/agent.py
from agno.agent import Agent
from agno.models.openai import OpenAIChat

def generate_explainable_insight(district: str, current_prediction: dict, historical_stats: dict):
    agent = Agent(
        model=OpenAIChat(id="gpt-4o-mini", temperature=0.2),
        description="You are an expert public health analyst for EpiLink.",
        instructions=[
            f"Analyze the following dengue prediction for {district}.",
            "Provide a highly concise, 3-bullet point explanation of:",
            "1. Why the risk level is what it is.",
            "2. The primary contributing factors (e.g., weather, historical trend).",
            "3. One actionable recommendation."
        ]
    )

    # In Phase 2, you would retrieve vector documents or give the agent a knowledge base here
    # agent.knowledge = PGVectorKnowledgeBase(...)

    prompt = f"Current Prediction Data: {current_prediction}\nRecent Historical Data: {historical_stats}"
    response = agent.run(prompt)

    return response.content
```

## Summary

Building this completely elevates the EpiLink project from a standard data visualization tool into a **Proactive Decision Support System**. It perfectly complements your existing XGBoost/LightGBM machine learning outputs by demystifying them for the end-user.

### Current State

Phases 1–3 and Enhancements 1–7 are complete. The service delivers:
- SHAP-grounded explainable insights via Gemini 2.0 Flash
- RAG retrieval over a pgvector-backed MoH document corpus
- 11-tool agentic chat with Redis session persistence
- National situation reports and 26-district batch processing
- Geographic spillover detection and confidence splitting

### Road to Production

The next milestone is the **Production RAG Pipeline** (Enhancements 12–15):

1. **Enhancement 12** — Swap pgvector for Qdrant. Unblocks payload-filtered retrieval and hybrid search.
2. **Enhancement 13** — Add BM25 sparse vectors and RRF fusion. Improves retrieval precision for exact MoH terminology.
3. **Enhancement 14** — Apply time-decay scoring. Prioritises recent guidelines and current-year outbreak data.
4. **Enhancement 15** — Automate weekly ETL via APScheduler. Keeps the corpus current with live surveillance data without manual intervention.

Together these four enhancements close the gap between the current prototype and the architecture described in `RAG_ARCHITECTURE.md`, producing a system where the LLM is continuously grounded in up-to-date, district-relevant, document-cited evidence.
