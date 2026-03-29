# Explainable AI (XAI) for EpiLink Analytics

Adding an "Explainable Insights" feature using an LLM / RAG-based approach is an **excellent and highly impactful idea**. Often, analytical dashboards displaying complex ML predictions (like EpiLink's DS-level XGBoost/LightGBM ensemble outputs) are difficult for non-technical stakeholders (e.g., Medical Officers of Health) to interpret and translate into action.

By integrating a RAG (Retrieval-Augmented Generation) system, you can bridge the gap between "raw prediction metrics" and "actionable public health interventions."

---

## Why This Feature is Valuable

1. **Democratizes Data**: Translates complex ML outputs (quantile regressions, uncertainty bounds) into plain-language summaries (e.g., "Colombo has a high predicted outbreak risk next week primarily due to recent heavy rainfall and a 15% WoW increase in reported cases.").
2. **Context-Aware Recommendations**: By feeding historical data and established Ministry of Health guidelines into the RAG, the system can recommend specific resource allocations (e.g., "Deploy fogging teams to Zone A").
3. **Trust and Transparency**: Explainable AI (XAI) builds trust. If a user understands _why_ the model made a prediction, they are more likely to act on it.

---

## Proposed Architecture

### 1. Data Sources (The Context)

- **Structured Data**: Recent dengue case counts, weather data, and the latest predictions from your ML ensemble.
- **Unstructured Data (RAG Corpus)**: Historical outbreak reports, standard operating procedures (SOPs) for dengue control, and past successful interventions.

### 2. The Engine (Backend - NestJS & Python AI Service)

- **Vector Database**: Store vector embeddings of your unstructured text (e.g., Postgres `pgvector` since you use TypeORM, or a dedicated vector DB like Pinecone/Milvus/Qdrant).
- **AI Agent Framework (Agno)**: Use **Agno** (a fast, lightweight Python framework for building AI agents) to handle LLM orchestration, memory, and tools.
- **Integration**: The NestJS backend will communicate with the Agno-powered Python service via REST or gRPC.
- **Process Flow**:
  1.  User views the dashboard for a specific district (e.g., Colombo).
  2.  Frontend requests "Insights" for Colombo from the NestJS backend.
  3.  Backend pulls the latest structured stats (weather, case counts, prediction score) and forwards the request to the Agno AI service.
  4.  The Agno Agent queries the Vector DB for similar historical situations (e.g., past outbreaks with similar weather patterns).
  5.  The Agno Agent constructs a prompt combining: `[System Prompt]` + `[Current Stats]` + `[Historical Context from RAG]`.
  6.  The Agent generates the insight summary and actionable recommendations, which are returned via NestJS to the frontend.

### 3. The Interface (Frontend - React/React Native)

- **Insight Cards**: Display brief, human-readable insights next to complex charts.
- **"Explain This" Button**: A tooltip or modal that users can click to get a natural language breakdown of a specific chart or prediction.
- **Interactive Chat (Optional)**: A specialized chat interface where users can ask questions like, "What were the most effective actions taken during the similar 2024 outbreak?"

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

### Phase 2: Introducing RAG (Adding Unstructured Data) — IN PROGRESS

- Request/response models already carry `rag_context` and `references` fields.
- **Remaining work**: wire pgvector retrieval inside the service so the LLM can cite actual MoH documents rather than receiving pre-retrieved strings from the NestJS backend.
- **Goal**: The LLM can now state, _"Based on the Ministry of Health's 2023 guidelines and similar past trends, recommended actions are..."_

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

## Enhancement Priority Summary

| # | Enhancement | Effort | Impact | Status |
|---|------------|--------|--------|--------|
| 1 | SHAP / feature importances in key drivers | Medium | Critical | **Done** |
| 2 | Complete Phase 2 RAG pipeline | High | Critical | **Done** |
| 3 | National summary + batch explain endpoints | Low | High | **Done** |
| 4 | Expanded agent tool library (5 new tools) | Medium | High | **Done** |
| 5 | Spatial / geographic cluster analysis | Medium | High | **Done** |
| 6 | Meaningful confidence and uncertainty fields | Low | Medium | **Done** |
| 7 | Session persistence for agentic chat (Redis) | Medium | Medium | **Done** |
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

The current implementation has delivered Phase 1 and Phase 3 baselines. The enhancements above close the gap between a functional prototype and a production-grade, trustworthy public health decision support tool — with genuine explainability rooted in model internals (SHAP), grounded recommendations from MoH documents (RAG), and operational reliability (caching, logging, session persistence).
