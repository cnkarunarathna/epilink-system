from fastapi import FastAPI

from explain_analytics.config import settings
from explain_analytics.models import (
    ChatRequest,
    ChatResponse,
    ExplainInsightRequest,
    ExplainInsightResponse,
)
from explain_analytics.services.insight_service import (
    AgenticInsightService,
    ExplainabilityService,
)

app = FastAPI(
    title=settings.service_name,
    version=settings.service_version,
    description="Explainable insights service for EpiLink risk analytics",
)
insight_service = ExplainabilityService()
agent_service = AgenticInsightService()


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": settings.service_name,
        "environment": settings.environment,
        "agent_mode": str(settings.enable_agent_mode),
    }


@app.post("/v1/insights/explain", response_model=ExplainInsightResponse)
def explain(payload: ExplainInsightRequest) -> ExplainInsightResponse:
    return insight_service.generate_insight(payload)


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
