from typing import Literal

from pydantic import BaseModel, Field


RiskLevel = Literal["low", "moderate", "high", "critical"]
TrendDirection = Literal["rising", "falling", "stable"]


class DocumentReference(BaseModel):
    """A citable source document retrieved from the RAG corpus."""

    title: str
    source: str
    published_date: str | None = None
    excerpt: str
    relevance_score: float | None = Field(default=None, ge=0, le=1)
    source_type: str | None = None
    chunk_index: int | None = None
    point_id: str | None = Field(
        default=None,
        description="Qdrant point UUID — submit to POST /v1/rag/feedback to vote on this document.",
    )
    feedback_ratio: float = Field(
        default=0.5,
        ge=0,
        le=1,
        description=(
            "Cumulative user feedback ratio (positive / total votes). "
            "0.5 = no votes yet (neutral). Used internally as a score multiplier."
        ),
    )


class DistrictSignal(BaseModel):
    """Snapshot of a neighbouring district's current dengue situation."""

    district: str
    recent_case_count: int = Field(ge=0)
    wow_case_change_pct: float | None = None
    model_risk_score: float = Field(ge=0, le=1)
    trend_direction: "TrendDirection" = "stable"


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
    feature_importances: dict[str, float] | None = Field(
        default=None,
        description=(
            "SHAP-based feature contributions from the XGBoost/LightGBM ensemble. "
            "Keys are feature names, values are fractional contributions (0.0–1.0, sum ≈ 1.0). "
            "When present, used as the authoritative source for key_drivers generation."
        ),
    )
    neighboring_districts: list[DistrictSignal] = Field(
        default_factory=list,
        description=(
            "Current surveillance snapshots for geographically adjacent districts. "
            "Used for spatial cluster detection and spillover risk assessment."
        ),
    )
    data_last_updated: str | None = Field(
        default=None,
        description=(
            "ISO-8601 datetime when this district's data was last refreshed "
            "(e.g. '2026-03-22T00:00:00Z'). Used to compute data_freshness_warning."
        ),
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
    document_references: list[DocumentReference] = Field(
        default_factory=list,
        description="Structured source documents retrieved from the RAG corpus (Phase 2+)",
    )
    implementation_phase: str
    # ── Enhancement 6: split confidence into two distinct dimensions ──────────
    confidence_score: int = Field(
        default=50,
        ge=0,
        le=100,
        description=(
            "Backward-compatible alias for data_completeness_score. "
            "Prefer data_completeness_score and prediction_confidence instead."
        ),
    )
    data_completeness_score: int = Field(
        default=50,
        ge=0,
        le=100,
        description=(
            "Signal completeness (0–100). Scores the number of input signals "
            "that are present: base 30 pts + 12 pts per filled optional field. "
            "Reflects how much data was available, not how certain the model is."
        ),
    )
    prediction_confidence: int = Field(
        default=50,
        ge=0,
        le=100,
        description=(
            "Model certainty (0–100) derived from the ensemble's uncertainty bounds. "
            "Narrow uncertainty_lower/upper interval → high confidence. "
            "Returns 50 when uncertainty bounds are unavailable."
        ),
    )
    data_freshness_warning: bool = Field(
        default=False,
        description=(
            "True when the latest surveillance data is more than 7 days old, "
            "indicating that predictions may not reflect the most recent situation."
        ),
    )
    # ── End Enhancement 6 ─────────────────────────────────────────────────────
    trend_direction: TrendDirection = "stable"
    spillover_risk: bool = Field(
        default=False,
        description=(
            "True when a high- or critical-risk neighbouring district is detected, "
            "or when 3+ neighbours are simultaneously rising — indicating geographic "
            "cluster spread rather than isolated local transmission."
        ),
    )
    follow_up_answer: str | None = None


# ── Batch explain models (Enhancement 3) ─────────────────────────

class BatchExplainRequest(BaseModel):
    requests: list["ExplainInsightRequest"] = Field(
        min_length=1,
        max_length=26,
        description="One request per district. Maximum 26 (all Sri Lanka districts).",
    )


class BatchExplainResponse(BaseModel):
    results: list["ExplainInsightResponse"]
    total: int
    urgent_districts: list[str] = Field(
        description="Districts with risk_level == 'critical' or model_risk_score >= 0.85"
    )
    by_risk_level: dict[str, int] = Field(
        description="Count of districts per risk level: critical, high, moderate, low"
    )
    prediction_week: str | None
    generated_at: str


# ── National summary models (Enhancement 3) ───────────────────────

class DistrictHighlight(BaseModel):
    district: str
    risk_level: RiskLevel
    recent_case_count: int
    wow_pct: float | None
    trend: TrendDirection
    is_urgent: bool


class NationalSummaryResponse(BaseModel):
    situation_report: str = Field(
        description="3-paragraph executive narrative generated for senior health officials"
    )
    urgent_districts: list[str]
    district_highlights: list[DistrictHighlight] = Field(
        description="All districts sorted by descending risk"
    )
    total_districts_analysed: int
    total_national_cases: int
    by_risk_level: dict[str, int]
    prediction_week: str | None
    generated_at: str
    implementation_phase: str


# ── RAG ingestion models (Phase 2) ────────────────────────────────

class RagIngestDocument(BaseModel):
    title: str = Field(min_length=3, max_length=500)
    source: str = Field(min_length=2, max_length=300)
    published_date: str | None = None
    content: str = Field(min_length=10)


class RagIngestRequest(BaseModel):
    documents: list[RagIngestDocument] = Field(min_length=1)


class RagIngestResponse(BaseModel):
    ingested: int
    message: str


class RagSeedResponse(BaseModel):
    ingested: int
    skipped: int
    total_documents: int
    message: str


class DocumentFeedbackRequest(BaseModel):
    point_id: str = Field(description="Qdrant point UUID from DocumentReference.point_id")
    vote: Literal["up", "down"]
    session_id: str | None = None


# ── Chat models (Phase 3 + Enhancement 7) ─────────────────────────

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    tool_calls: list[str] | None = None


class ChatRequest(BaseModel):
    district: str = Field(min_length=2, max_length=120)
    # Enhancement 7: clients send only the new user message; history is
    # stored server-side in Redis.  `messages` is kept for backward
    # compatibility — ignored when `message` is present.
    message: str = Field(
        min_length=1,
        max_length=4000,
        description="The new user message to send. Server retrieves full history from Redis.",
    )
    session_id: str | None = Field(
        default=None,
        description="Existing session ID to continue, or None to start a new session.",
    )
    structured_signals: StructuredSignals | None = None


class ChatResponse(BaseModel):
    reply: str
    tool_calls_used: list[str] = Field(default_factory=list)
    session_id: str
    # Enhancement 7 additions
    turn_count: int = Field(
        default=0,
        description="Total number of user turns stored in this session.",
    )
    context_compressed: bool = Field(
        default=False,
        description="True when older messages were summarised in this response cycle.",
    )
    document_references: list[dict] = Field(
        default_factory=list,
        description=(
            "RAG documents pre-retrieved from the knowledge base and used as context "
            "for this response. Each entry has title, source, published_date, excerpt, "
            "and relevance_score."
        ),
    )


# ── Enhancement 7: session history models ─────────────────────────

class ChatSessionHistoryResponse(BaseModel):
    session_id: str
    messages: list[ChatMessage]
    message_count: int
    turn_count: int = Field(
        description="Number of completed user+assistant pairs in the session.",
    )

