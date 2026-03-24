# Explain Analytics Service

Python service for EpiLink explainable insights, created with uv.

## Implementation Analysis from EXPLAINABLE_ANALYTICS.md

This service is aligned to the phased plan in the implementation document:

1. Phase 1 (implemented now): structured data to text

- Accepts district-level structured signals and produces concise explanations.
- Returns risk level, key drivers, recommendations, and caveats.

2. Phase 2 (prepared contract): introduce RAG context

- Request model already includes `rag_context` for retrieved guideline/report snippets.
- Response model includes `references` field for provenance.

3. Phase 3 (future): agentic workflows

- Service layer is isolated under `services/insight_service.py` to swap deterministic logic with LLM + tool-calling orchestration.

## Tech Stack

- Python 3.11+
- uv for dependency and environment management
- FastAPI for API service
- Uvicorn for ASGI runtime
- pydantic-settings for environment configuration
- Google Gemini API (Google AI Studio) via `google-genai`

## Project Structure

src/explain_analytics/

- `__init__.py` CLI entrypoint
- `main.py` FastAPI app and routes
- `models.py` request/response contracts
- `config.py` environment settings
- `services/insight_service.py` explainability logic

## Endpoints

- `GET /health`
- `POST /v1/insights/explain`

## Quick Start

1. Install dependencies

```bash
uv sync
```

2. Configure environment values

```bash
cp .env.example .env
```

For Gemini via Google AI Studio, set:

```bash
EXPLAIN_LLM_PROVIDER=gemini
EXPLAIN_LLM_MODEL=gemini-2.0-flash
EXPLAIN_GEMINI_API_KEY=your_google_ai_studio_api_key
```

3. Run the service

```bash
uv run explain-analytics
```

4. Open API docs

- http://localhost:8010/docs

## Sample Request

```json
{
  "district": "Colombo",
  "prediction_week": "2026-W12",
  "structured_signals": {
    "recent_case_count": 142,
    "wow_case_change_pct": 16.3,
    "rainfall_mm_7d": 112.0,
    "temperature_c_7d": 29.1,
    "model_risk_score": 0.78,
    "uncertainty_lower": 0.62,
    "uncertainty_upper": 0.88
  },
  "rag_context": [
    "MOH dengue guideline 2023 section 4.2",
    "Colombo outbreak response report 2024"
  ]
}
```

## Next Integration with NestJS

- NestJS analytics module can call `POST /v1/insights/explain` after aggregating latest weather/case/prediction features.
- In Phase 2, replace `rag_context` placeholders with retrieved chunks from pgvector.

## Gemini Behavior

- If `EXPLAIN_LLM_PROVIDER=gemini` and a valid `EXPLAIN_GEMINI_API_KEY` is provided, the service uses Gemini to generate the explanation text.
- If Gemini is not configured or fails at runtime, the service automatically falls back to deterministic rule-based output.
