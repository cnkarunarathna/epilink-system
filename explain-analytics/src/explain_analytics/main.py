from contextlib import asynccontextmanager
from datetime import datetime, timezone
import logging

from fastapi import Depends, FastAPI, Header, HTTPException, Query

from explain_analytics.config import settings
from explain_analytics.models import (
    BatchExplainRequest,
    BatchExplainResponse,
    ChatRequest,
    ChatResponse,
    ChatSessionHistoryResponse,
    ChatMessage,
    ExplainInsightRequest,
    ExplainInsightResponse,
    NationalSummaryResponse,
    RagIngestRequest,
    RagIngestResponse,
    RagSeedResponse,
)
from explain_analytics.services.insight_service import (
    AgenticInsightService,
    ExplainabilityService,
)
from explain_analytics.services.knowledge_seeder import KnowledgeSeeder
from explain_analytics.services.etl_service import ETLService
from explain_analytics.services.national_service import NationalSummaryService
from explain_analytics.services.rag_service import RAGService
from explain_analytics.services.session_service import SessionService
from explain_analytics.services.tools import (
    get_cross_district_spillover,
    get_demographic_hotspots,
    get_intervention_history,
    get_model_performance_metrics,
    get_seasonal_pattern,
)
from explain_analytics.shared.context import get_request_context, require_admin


logger = logging.getLogger(__name__)

insight_service = ExplainabilityService()
session_service = SessionService(
    redis_url=settings.redis_url,
    ttl_seconds=settings.session_ttl_seconds,
    summarize_after_turns=settings.session_summarize_after_turns,
)
rag_service = RAGService()
agent_service = AgenticInsightService(
    session_service=session_service, rag_service=rag_service
)
national_service = NationalSummaryService()
etl_service = ETLService(rag_service=rag_service)
knowledge_seeder = KnowledgeSeeder(rag_service=rag_service)


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = None
    if settings.rag_etl_enabled:
        from apscheduler.schedulers.background import BackgroundScheduler

        scheduler = BackgroundScheduler()
        scheduler.add_job(
            etl_service.run,
            trigger="cron",
            day_of_week="mon",
            hour=0,
            minute=30,
            id="etl_weekly",
        )
        scheduler.start()
        job = scheduler.get_job("etl_weekly")
        if job and job.next_run_time:
            etl_service.set_next_run(job.next_run_time)
    yield
    if scheduler:
        scheduler.shutdown(wait=False)


app = FastAPI(
    title=settings.service_name,
    version=settings.service_version,
    description="Explainable insights service for EpiLink risk analytics",
    lifespan=lifespan,
)


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "service": settings.service_name,
        "environment": settings.environment,
        "agent_mode": settings.enable_agent_mode,
        "rag_enabled": rag_service.is_ready,
        "rag_document_count": rag_service.document_count(),
        "session_persistence": session_service.is_ready,  # Enhancement 7
    }


@app.post(
    "/v1/insights/explain",
    response_model=ExplainInsightResponse,
    dependencies=[Depends(require_admin)],
)
def explain(
    payload: ExplainInsightRequest,
    ctx: dict[str, object] = Depends(get_request_context),
) -> ExplainInsightResponse:
    logger.info(
        "insight explain request user=%s role=%s request_id=%s district=%s",
        ctx.get("user_id"),
        ctx.get("role"),
        ctx.get("request_id"),
        payload.district,
    )
    return insight_service.generate_insight(payload, rag_service=rag_service)


@app.post(
    "/v1/insights/chat",
    response_model=ChatResponse,
    dependencies=[Depends(require_admin)],
)
def chat(
    payload: ChatRequest,
    ctx: dict[str, object] = Depends(get_request_context),
) -> ChatResponse:
    """Send a new message to the agentic chat session.

    Enhancement 7: only the new `message` string + optional `session_id` are
    required.  Full history is managed server-side in Redis.
    """
    logger.info(
        "insight chat request user=%s role=%s request_id=%s district=%s session=%s",
        ctx.get("user_id"),
        ctx.get("role"),
        ctx.get("request_id"),
        payload.district,
        payload.session_id or "",
    )
    signals = (
        payload.structured_signals.model_dump() if payload.structured_signals else None
    )
    result = agent_service.chat(
        district=payload.district,
        new_message=payload.message,
        session_id=payload.session_id or "",
        structured_signals=signals,
    )
    return ChatResponse(**result)


# ── Enhancement 7: session history and management endpoints ──────────


@app.get(
    "/v1/insights/chat/{session_id}/history", response_model=ChatSessionHistoryResponse
)
def get_chat_history(
    session_id: str,
    _: None = Depends(require_admin),
) -> ChatSessionHistoryResponse:
    """Retrieve all stored messages for a chat session.

    Returns the full message history as it is currently stored in Redis.
    Returns an empty history (not a 404) when the session does not exist or
    Redis is not configured.
    """
    messages_raw = session_service.get_messages(session_id)
    messages = [ChatMessage(role=m["role"], content=m["content"]) for m in messages_raw]
    turn_count = len(messages) // 2
    return ChatSessionHistoryResponse(
        session_id=session_id,
        messages=messages,
        message_count=len(messages),
        turn_count=turn_count,
    )


@app.delete("/v1/insights/chat/{session_id}", status_code=200)
def delete_chat_session(
    session_id: str,
    _: None = Depends(require_admin),
) -> dict[str, object]:
    """Explicitly end a chat session and remove its history from Redis."""
    deleted = session_service.delete_session(session_id)
    return {
        "session_id": session_id,
        "deleted": deleted,
        "message": (
            f"Session {session_id} deleted."
            if deleted
            else f"Session {session_id} not found (may have already expired)."
        ),
    }


# ── Batch and national endpoints (Enhancement 3) ─────────────────


@app.post("/v1/insights/batch-explain", response_model=BatchExplainResponse)
def batch_explain(
    payload: BatchExplainRequest,
    _: None = Depends(require_admin),
) -> BatchExplainResponse:
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
            result = result.model_copy(update={"summary": f"URGENT: {result.summary}"})
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
    _: None = Depends(require_admin),
) -> NationalSummaryResponse:
    """Generate an executive 3-paragraph situation report for all Sri Lanka districts.

    Fetches live data from the NestJS analytics backend, classifies each district,
    and produces a Gemini-powered narrative for senior health officials.
    Falls back to a rule-based report if the LLM is unavailable.
    """
    return national_service.generate(prediction_week=week)


# ── Enhancement 4: Direct tool endpoints ─────────────────────────

import json as _json


@app.get("/v1/tools/seasonal-pattern/{district}")
def tool_seasonal_pattern(
    district: str,
    years: int = Query(
        default=3, ge=1, le=10, description="Number of past years to overlay"
    ),
) -> dict:
    """Week-by-week multi-year seasonal pattern for a district."""
    return _json.loads(get_seasonal_pattern(district, years))


@app.get("/v1/tools/spillover/{district}")
def tool_spillover(district: str) -> dict:
    """Cross-district spillover risk for the focal district and all its neighbours."""
    return _json.loads(get_cross_district_spillover(district))


@app.get("/v1/tools/intervention-history/{district}")
def tool_intervention_history(district: str) -> dict:
    """Inferred past response events from timeseries peaks and post-peak declines."""
    return _json.loads(get_intervention_history(district))


@app.get("/v1/tools/model-performance/{district}")
def tool_model_performance(district: str) -> dict:
    """Prediction accuracy metrics comparing ML forecast against recent actuals."""
    return _json.loads(get_model_performance_metrics(district))


@app.get("/v1/tools/demographic-hotspots/{district}")
def tool_demographic_hotspots(district: str) -> dict:
    """Sub-district zone risk breakdown with intervention priority ranking."""
    return _json.loads(get_demographic_hotspots(district))


# ── RAG corpus management (Phase 2) ───────────────────────────────


@app.get("/v1/rag/status")
def rag_status() -> dict[str, object]:
    """Report RAG readiness and corpus size."""
    return {
        "rag_enabled": rag_service.is_ready,
        "qdrant_url": settings.qdrant_url,
        "qdrant_collection": settings.qdrant_collection,
        "embedding_model": settings.rag_embedding_model,
        "retrieval_mode": settings.rag_retrieval_mode,
        "top_k": settings.rag_top_k,
        "recency_decay_lambda": settings.rag_recency_decay_lambda,
        "document_count": rag_service.document_count(),
    }


@app.post("/v1/rag/ingest", response_model=RagIngestResponse)
def rag_ingest(
    payload: RagIngestRequest,
    _: None = Depends(require_admin),
) -> RagIngestResponse:
    """Embed and upsert MoH documents into the Qdrant corpus."""
    if not settings.qdrant_url:
        raise HTTPException(
            status_code=503,
            detail="EXPLAIN_QDRANT_URL is not configured. "
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
        message=f"Successfully embedded and stored {count} document(s) in the Qdrant corpus.",
    )


@app.post("/v1/rag/seed", response_model=RagSeedResponse)
def rag_seed(
    force: bool = Query(
        default=False,
        description=(
            "When true, re-ingest all knowledge documents even if the corpus already "
            "contains documents. Safe to call multiple times — idempotent point IDs "
            "prevent true duplicates in Qdrant."
        ),
    ),
    x_internal_api_key: str | None = Header(default=None),
    _: None = Depends(require_admin),
) -> RagSeedResponse:
    """Seed the Qdrant corpus with the built-in dengue knowledge base (25 documents).

    Covers WHO/MoH clinical guidelines, vector control protocols, Sri Lanka
    epidemiology, outbreak response, dengue biology, and treatment protocols.

    Protected by x-internal-api-key when EXPLAIN_BACKEND_SERVICE_KEY is set.
    Skips seeding silently when the corpus already contains documents (use
    force=true to re-seed).
    """
    if (
        settings.backend_service_key
        and x_internal_api_key != settings.backend_service_key
    ):
        raise HTTPException(
            status_code=403, detail="Invalid or missing x-internal-api-key."
        )
    if not settings.qdrant_url:
        raise HTTPException(
            status_code=503,
            detail="EXPLAIN_QDRANT_URL is not configured.",
        )
    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=503,
            detail="EXPLAIN_GEMINI_API_KEY is required for embedding documents.",
        )
    result = knowledge_seeder.seed(force=force)
    return RagSeedResponse(**result)


@app.get("/v1/rag/etl/status")
def rag_etl_status() -> dict[str, object]:
    """Return the current ETL pipeline state: last run, next scheduled run, and error if any."""
    return etl_service.status


@app.post("/v1/rag/etl/run")
def rag_etl_run(
    x_internal_api_key: str | None = Header(default=None),
    _: None = Depends(require_admin),
) -> dict[str, object]:
    """Manually trigger the surveillance ETL job.

    Protected by x-internal-api-key when EXPLAIN_BACKEND_SERVICE_KEY is set.
    """
    if (
        settings.backend_service_key
        and x_internal_api_key != settings.backend_service_key
    ):
        raise HTTPException(
            status_code=403, detail="Invalid or missing x-internal-api-key."
        )
    if not rag_service.is_ready:
        raise HTTPException(
            status_code=503,
            detail="RAG service is not ready. Ensure EXPLAIN_RAG_ENABLED=true and Qdrant is reachable.",
        )
    return etl_service.run()
