[PostgreSQL] ──┐
               ├──> [FastAPI ETL Layer]
[Weather API] ─┘

        ↓
[Text + Insight Generation]

        ↓
[Embedding Model]

        ↓
[Qdrant Vector DB]

        ↓
[Retriever (Hybrid + Time-aware)]

        ↓
[LLM (Explainable Prompt)]

        ↓
[Admin Dashboard Insights]