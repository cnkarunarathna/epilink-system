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

    model_config = SettingsConfigDict(
        env_prefix="EXPLAIN_",
        env_file=".env",
        extra="ignore",
    )


settings = Settings()
