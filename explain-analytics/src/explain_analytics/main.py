from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Query

from explain_analytics.config import settings
from explain_analytics.models import (
    BatchExplainRequest,
    BatchExplainResponse,
    ChatRequest,
    ChatResponse,
    ExplainInsightRequest,
    ExplainInsightResponse,
    NationalSummaryResponse,
    RagIngestRequest,
    RagIngestResponse,
)
from explain_analytics.services.insight_service import (
    AgenticInsightService,
    ExplainabilityService,
)
from explain_analytics.services.national_service import NationalSummaryService
from explain_analytics.services.rag_service import RAGService

app = FastAPI(
    title=settings.service_name,
    version=settings.service_version,
    description="Explainable insights service for EpiLink risk analytics",
)
insight_service = ExplainabilityService()
agent_service = AgenticInsightService()
rag_service = RAGService()
national_service = NationalSummaryService()


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "service": settings.service_name,
        "environment": settings.environment,
        "agent_mode": settings.enable_agent_mode,
        "rag_enabled": rag_service.is_ready,
    }


@app.post("/v1/insights/explain", response_model=ExplainInsightResponse)
def explain(payload: ExplainInsightRequest) -> ExplainInsightResponse:
    return insight_service.generate_insight(payload, rag_service=rag_service)


@app.post("/v1/insights/chat", response_model=ChatResponse)
def chat(payload: ChatRequest) -> ChatResponse:
    messages = [{"role": m.role, "content": m.content} for m in payload.messages]
    signals = payload.structured_signals.model_dump() if payload.structured_signals else None
    result = agent_service.chat(
        district=payload.district,
        messages=messages,
        session_id=payload.session_id or "",
        structured_signals=signals,
    )
    return ChatResponse(**result)


# ── Batch and national endpoints (Enhancement 3) ─────────────────

@app.post("/v1/insights/batch-explain", response_model=BatchExplainResponse)
def batch_explain(payload: BatchExplainRequest) -> BatchExplainResponse:
    """Generate individual insights for a list of districts in one call.

    Processes each request through the full insight pipeline (rule-based + Gemini + RAG).
    Applies an URGENT prefix to summaries where risk_level is critical.
    Designed for automated weekly situation reports, not real-time dashboards.
    """
    results: list[ExplainInsightResponse] = []
    by_risk: dict[str, int] = {"critical": 0, "high": 0, "moderate": 0, "low": 0}
    urgent_districts: list[str] = []

    for req in payload.requests:
        result = insight_service.generate_insight(req, rag_service=rag_service)

        # Apply URGENT prefix for critical-risk districts
        is_urgent = (
            result.risk_level == "critical"
            or req.structured_signals.model_risk_score >= 0.85
        )
        if is_urgent and not result.summary.startswith("URGENT:"):
            result = result.model_copy(
                update={"summary": f"URGENT: {result.summary}"}
            )
            urgent_districts.append(result.district)

        by_risk[result.risk_level] = by_risk.get(result.risk_level, 0) + 1
        results.append(result)

    # Derive a shared prediction_week if all requests agree
    weeks = {r.prediction_week for r in payload.requests if r.prediction_week}
    prediction_week = weeks.pop() if len(weeks) == 1 else None

    return BatchExplainResponse(
        results=results,
        total=len(results),
        urgent_districts=urgent_districts,
        by_risk_level=by_risk,
        prediction_week=prediction_week,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


@app.get("/v1/insights/national-summary", response_model=NationalSummaryResponse)
def national_summary(
    week: str | None = Query(
        default=None,
        description="ISO week override, e.g. '2026-W13'. Defaults to current week.",
    ),
) -> NationalSummaryResponse:
    """Generate an executive 3-paragraph situation report for all Sri Lanka districts.

    Fetches live data from the NestJS analytics backend, classifies each district,
    and produces a Gemini-powered narrative for senior health officials.
    Falls back to a rule-based report if the LLM is unavailable.
    """
    return national_service.generate(prediction_week=week)


# ── RAG corpus management (Phase 2) ───────────────────────────────

@app.get("/v1/rag/status")
def rag_status() -> dict[str, object]:
    """Report RAG readiness and corpus size."""
    return {
        "rag_enabled": rag_service.is_ready,
        "pgvector_configured": bool(settings.pgvector_url),
        "embedding_model": settings.rag_embedding_model,
        "top_k": settings.rag_top_k,
        "document_count": rag_service.document_count() if settings.pgvector_url else 0,
    }


@app.post("/v1/rag/ingest", response_model=RagIngestResponse)
def rag_ingest(payload: RagIngestRequest) -> RagIngestResponse:
    """Embed and store MoH documents into the pgvector corpus."""
    if not settings.pgvector_url:
        raise HTTPException(
            status_code=503,
            detail="EXPLAIN_PGVECTOR_URL is not configured. "
                   "Set it in .env and restart the service before ingesting documents.",
        )
    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=503,
            detail="EXPLAIN_GEMINI_API_KEY is not configured. "
                   "Embeddings require the Gemini API.",
        )
    try:
        count = rag_service.ingest(payload.documents)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return RagIngestResponse(
        ingested=count,
        message=f"Successfully embedded and stored {count} document(s) in the RAG corpus.",
    )
