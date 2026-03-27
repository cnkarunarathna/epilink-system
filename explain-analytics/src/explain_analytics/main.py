from fastapi import FastAPI, HTTPException

from explain_analytics.config import settings
from explain_analytics.models import (
    ChatRequest,
    ChatResponse,
    ExplainInsightRequest,
    ExplainInsightResponse,
    RagIngestRequest,
    RagIngestResponse,
)
from explain_analytics.services.insight_service import (
    AgenticInsightService,
    ExplainabilityService,
)
from explain_analytics.services.rag_service import RAGService

app = FastAPI(
    title=settings.service_name,
    version=settings.service_version,
    description="Explainable insights service for EpiLink risk analytics",
)
insight_service = ExplainabilityService()
agent_service = AgenticInsightService()
rag_service = RAGService()


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
