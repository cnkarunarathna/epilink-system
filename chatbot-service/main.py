"""EpiBot - RAG Chatbot Service for Dengue Information"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from services import get_rag_service
from config import HOST, PORT


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup: Auto-ingest PDFs
    print("🚀 Starting EpiBot RAG Service...")
    rag_service = get_rag_service()
    results = rag_service.ingest_all_pdfs()
    if results:
        print(f"📚 Auto-ingested PDFs: {results}")
    else:
        print("📁 No PDFs found in data directory")
    stats = rag_service.get_collection_stats()
    print(f"📊 Knowledge base: {stats['document_count']} document chunks")
    yield
    # Shutdown
    print("👋 Shutting down EpiBot RAG Service...")


app = FastAPI(
    title="EpiBot RAG Service",
    description="Retrieval-Augmented Generation chatbot for dengue information",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response models
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    sources: list[dict] = []
    note: Optional[str] = None


class IngestResponse(BaseModel):
    status: str
    results: dict


class HealthResponse(BaseModel):
    status: str
    service: str
    collection_stats: dict


# Endpoints
@app.get("/", tags=["Root"])
async def root():
    return {"message": "EpiBot RAG Service is running", "docs": "/docs"}


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Check service health and get collection stats"""
    try:
        rag_service = get_rag_service()
        stats = rag_service.get_collection_stats()
        return {
            "status": "healthy",
            "service": "epibot-rag",
            "collection_stats": stats,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat", response_model=ChatResponse, tags=["Chat"])
async def chat(request: ChatRequest):
    """Send a message and get an AI-powered response"""
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    try:
        rag_service = get_rag_service()
        result = rag_service.query(request.message)
        return ChatResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ingest", response_model=IngestResponse, tags=["Admin"])
async def ingest_pdfs():
    """Ingest all PDFs from the data directory into Qdrant"""
    try:
        rag_service = get_rag_service()
        results = rag_service.ingest_all_pdfs()
        return {
            "status": "completed",
            "results": results,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=HOST, port=PORT)
