from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_name: str = "EpiLink Explainable Analytics Service"
    service_version: str = "0.1.0"
    environment: str = "development"

    llm_provider: str = "none"
    llm_model: str = "gemini-2.0-flash"
    openai_api_key: str | None = None
    gemini_api_key: str | None = None

    max_context_documents: int = 5
    default_temperature: float = 0.2

    qdrant_url: str = "http://localhost:6333"
    qdrant_collection: str = "epilink_rag"
    rag_enabled: bool = False
    rag_top_k: int = 5
    rag_embedding_model: str = "models/text-embedding-004"
    rag_retrieval_mode: str = "hybrid"  # "hybrid" | "dense" | "sparse"
    rag_recency_decay_lambda: float = 0.001          # default fallback (~2-year half-life)
    rag_recency_decay_surveillance: float = 0.05     # ~14-day half-life for case data
    rag_recency_decay_knowledge: float = 0.0001      # ~19-year half-life for clinical guides
    rag_recency_decay_guideline: float = 0.0003      # ~6-year half-life for MoH guidelines
    rag_etl_enabled: bool = False
    rag_chunk_size: int = 350
    rag_chunk_overlap: int = 60
    rag_hyde_enabled: bool = False

    enable_agent_mode: bool = True
    backend_api_url: str = "http://localhost:3001/api"

    redis_url: str | None = None
    session_ttl_seconds: int = 7200
    session_summarize_after_turns: int = 10

    model_config = SettingsConfigDict(
        env_prefix="EXPLAIN_",
        env_file=".env",
        extra="ignore",
    )


settings = Settings()
