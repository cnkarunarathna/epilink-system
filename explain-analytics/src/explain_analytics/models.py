from typing import Literal

from pydantic import BaseModel, Field


RiskLevel = Literal["low", "moderate", "high", "critical"]
TrendDirection = Literal["rising", "falling", "stable"]


class StructuredSignals(BaseModel):
    recent_case_count: int = Field(ge=0)
    wow_case_change_pct: float | None = None
    rainfall_mm_7d: float | None = Field(default=None, ge=0)
    temperature_c_7d: float | None = None
    model_risk_score: float = Field(ge=0, le=1)
    uncertainty_lower: float | None = Field(default=None, ge=0, le=1)
    uncertainty_upper: float | None = Field(default=None, ge=0, le=1)
    historical_trend: list[int] = Field(
        default_factory=list,
        description="Last 4 weekly case counts (most-recent first)",
    )


class ExplainInsightRequest(BaseModel):
    district: str = Field(min_length=2, max_length=120)
    prediction_week: str | None = Field(
        default=None, description="ISO-like week marker"
    )
    structured_signals: StructuredSignals
    rag_context: list[str] = Field(default_factory=list)
    user_question: str | None = None


class ExplainInsightResponse(BaseModel):
    district: str
    risk_level: RiskLevel
    summary: str
    key_drivers: list[str]
    recommendations: list[str]
    caveats: list[str]
    references: list[str]
    implementation_phase: str
    confidence_score: int = Field(
        default=50, ge=0, le=100, description="AI confidence 0-100"
    )
    trend_direction: TrendDirection = "stable"
    follow_up_answer: str | None = None


# ── Chat models (Phase 3) ──────────────────────────────────────────

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    tool_calls: list[str] | None = None


class ChatRequest(BaseModel):
    district: str = Field(min_length=2, max_length=120)
    messages: list[ChatMessage]
    session_id: str | None = None
    structured_signals: StructuredSignals | None = None


class ChatResponse(BaseModel):
    reply: str
    tool_calls_used: list[str] = Field(default_factory=list)
    session_id: str

