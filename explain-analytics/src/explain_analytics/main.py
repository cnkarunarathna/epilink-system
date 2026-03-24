from fastapi import FastAPI

from explain_analytics.config import settings
from explain_analytics.models import ExplainInsightRequest, ExplainInsightResponse
from explain_analytics.services.insight_service import ExplainabilityService

app = FastAPI(
    title=settings.service_name,
    version=settings.service_version,
    description="Explainable insights service for EpiLink risk analytics",
)
service = ExplainabilityService()


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": settings.service_name,
        "environment": settings.environment,
    }


@app.post("/v1/insights/explain", response_model=ExplainInsightResponse)
def explain(payload: ExplainInsightRequest) -> ExplainInsightResponse:
    return service.generate_insight(payload)
