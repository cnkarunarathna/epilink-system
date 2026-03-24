# Explainable AI (XAI) for EpiLink Analytics

Adding an "Explainable Insights" feature using an LLM / RAG-based approach is an **excellent and highly impactful idea**. Often, analytical dashboards displaying complex ML predictions (like EpiLink's DS-level XGBoost/LightGBM ensemble outputs) are difficult for non-technical stakeholders (e.g., Medical Officers of Health) to interpret and translate into action.

By integrating a RAG (Retrieval-Augmented Generation) system, you can bridge the gap between "raw prediction metrics" and "actionable public health interventions."

---

## 🌟 Why This Feature is Valuable

1. **Democratizes Data**: Translates complex ML outputs (quantile regressions, uncertainty bounds) into plain-language summaries (e.g., "Colombo has a high predicted outbreak risk next week primarily due to recent heavy rainfall and a 15% WoW increase in reported cases.").
2. **Context-Aware Recommendations**: By feeding historical data and established Ministry of Health guidelines into the RAG, the system can recommend specific resource allocations (e.g., "Deploy fogging teams to Zone A").
3. **Trust and Transparency**: Explainable AI (XAI) builds trust. If a user understands _why_ the model made a prediction, they are more likely to act on it.

---

## 🏛️ Proposed Architecture

### 1. Data Sources (The Context)

- **Structured Data**: Recent dengue case counts, weather data, and the latest predictions from your ML ensemble.
- **Unstructured Data (RAG Corpus)**: Historical outbreak reports, standard operating procedures (SOPs) for dengue control, and past successful interventions.

### 2. The Engine (Backend - NestJS & Python AI Service)

- **Vector Database**: Store vector embeddings of your unstructured text (e.g., Postgres `pgvector` since you use TypeORM, or a dedicated vector DB like Pinecone/Milvus/Qdrant).
- **AI Agent Framework (Agno)**: Use **Agno** (a fast, lightweight Python framework for building AI agents) to handle LLM orchestration, memory, and tools.
- **Integration**: The NestJS backend will communicate with the Agno-powered Python service via REST or gRPC.
- **Process Flow**:
  1.  User views the dashboard for a specific district (e.g., Colombo).
  2.  Frontend requests "Insights" for Colombo from the NestJS backend.
  3.  Backend pulls the latest structured stats (weather, case counts, prediction score) and forwards the request to the Agno AI service.
  4.  The Agno Agent queries the Vector DB for similar historical situations (e.g., past outbreaks with similar weather patterns).
  5.  The Agno Agent constructs a prompt combining: `[System Prompt]` + `[Current Stats]` + `[Historical Context from RAG]`.
  6.  The Agent generates the insight summary and actionable recommendations, which are returned via NestJS to the frontend.

### 3. The Interface (Frontend - React/React Native)

- **Insight Cards**: Display brief, human-readable insights next to complex charts.
- **"Explain This" Button**: A tooltip or modal that users can click to get a natural language breakdown of a specific chart or prediction.
- **Interactive Chat (Optional)**: A specialized chat interface where users can ask questions like, "What were the most effective actions taken during the similar 2024 outbreak?"

---

## 🛠️ Implementation Phasing

### Phase 1: Structured Data to Text (No RAG yet)

- Start simple. Feed the latest JSON payload of predictions and historical data directly into an LLM prompt (e.g., using OpenAI's `gpt-4o-mini` or Anthropic's `claude-3-haiku`).
- **Goal**: Generate a 2-3 sentence summary of the current dashboard state.

### Phase 2: Introducing RAG (Adding Unstructured Data)

- Incorporate a Vector Database (`pgvector` integrates seamlessly with your existing PostgreSQL setup).
- Embed historical post-outbreak reports and prevention guidelines.
- **Goal**: The LLM can now state, _"Based on the Ministry of Health's 2023 guidelines and similar past trends, recommended actions are..."_

### Phase 3: Agentic Workflows (Advanced via Agno Tools)

- Give the Agno Agent "tools" (Function Calling).
- Allow the Agent to dynamically run database queries or call external APIs (e.g., if a user asks, "How does this week compare to the same week last year?", the Agent can trigger an SQL query using a tool to find out).

---

## 💡 Quick Prototype Example (Pseudo-code for Agno)

```python
# ai_service/agent.py
from agno.agent import Agent
from agno.models.openai import OpenAIChat

def generate_explainable_insight(district: str, current_prediction: dict, historical_stats: dict):
    agent = Agent(
        model=OpenAIChat(id="gpt-4o-mini", temperature=0.2),
        description="You are an expert public health analyst for EpiLink.",
        instructions=[
            f"Analyze the following dengue prediction for {district}.",
            "Provide a highly concise, 3-bullet point explanation of:",
            "1. Why the risk level is what it is.",
            "2. The primary contributing factors (e.g., weather, historical trend).",
            "3. One actionable recommendation."
        ]
    )

    # In Phase 2, you would retrieve vector documents or give the agent a knowledge base here
    # agent.knowledge = PGVectorKnowledgeBase(...)

    prompt = f"Current Prediction Data: {current_prediction}\nRecent Historical Data: {historical_stats}"
    response = agent.run(prompt)
    
    return response.content
```

## Summary

Building this completely elevates the EpiLink project from a standard data visualization tool into a **Proactive Decision Support System**. It perfectly complements your existing XGBoost/LightGBM machine learning outputs by demystifying them for the end-user.
