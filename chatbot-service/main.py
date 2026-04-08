"""EpiBot - RAG Chatbot Service for Dengue Information"""

import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from services import (
    get_rag_service,
    create_session,
    delete_session,
    cleanup_expired_sessions,
    active_sessions_count,
)
from config import HOST, PORT


async def _session_cleanup_loop():
    """Background task: evict sessions inactive for longer than SESSION_TTL_MINUTES."""
    while True:
        await asyncio.sleep(60)  # check every minute
        removed = cleanup_expired_sessions()
        if removed:
            print(f"🧹 Expired {removed} inactive session(s)")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    print("🚀 Starting EpiBot RAG Service...")
    rag_service = get_rag_service()
    results = rag_service.ingest_all_pdfs()
    if results:
        print(f"📚 Ingestion results: {results}")
    else:
        print("📁 No PDFs found in data directory")
    stats = rag_service.get_collection_stats()
    print(f"📊 Knowledge base: {stats['document_count']} document chunks")

    cleanup_task = asyncio.create_task(_session_cleanup_loop())
    yield
    cleanup_task.cancel()
    print("👋 Shutting down EpiBot RAG Service...")


app = FastAPI(
    title="EpiBot RAG Service",
    description="Retrieval-Augmented Generation chatbot for dengue information",
    version="4.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response models ─────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    category: Optional[str] = None  # filter by category if provided


class ChatResponse(BaseModel):
    response: str
    sources: list[dict] = []
    confidence: Optional[str] = None   # "high" | "medium" | "low"
    note: Optional[str] = None


class IngestRequest(BaseModel):
    category: Optional[str] = None
    language: Optional[str] = None


class IngestResponse(BaseModel):
    status: str
    results: dict


class HealthResponse(BaseModel):
    status: str
    service: str
    collection_stats: dict


class SessionResponse(BaseModel):
    session_id: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/", tags=["Root"])
async def root():
    return {"message": "EpiBot RAG Service is running", "docs": "/docs"}


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Service health, Qdrant collection stats, and active session count"""
    try:
        rag_service = get_rag_service()
        stats = rag_service.get_collection_stats()
        return {"status": "healthy", "service": "epibot-rag", "collection_stats": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat", response_model=ChatResponse, tags=["Chat"])
async def chat(request: ChatRequest):
    """Send a message and get an AI-powered response. Pass session_id for multi-turn conversations."""
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    try:
        rag_service = get_rag_service()
        result = rag_service.query(
            request.message,
            category=request.category,
            session_id=request.session_id,
        )
        return ChatResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/session", response_model=SessionResponse, tags=["Session"])
async def start_session():
    """Create a new conversation session. Returns a session_id to pass with subsequent /chat requests."""
    session_id = create_session()
    return {"session_id": session_id}


@app.delete("/session/{session_id}", tags=["Session"])
async def end_session(session_id: str):
    """Explicitly end a session and discard its conversation history."""
    if not delete_session(session_id):
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")
    return {"status": "deleted", "session_id": session_id}


@app.post("/ingest", response_model=IngestResponse, tags=["Admin"])
async def ingest_pdfs():
    """Ingest all PDFs from the data directory into Qdrant (skips already-ingested files)"""
    try:
        rag_service = get_rag_service()
        results = rag_service.ingest_all_pdfs()
        return {"status": "completed", "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/documents", tags=["Admin"])
async def list_documents():
    """List all ingested documents with chunk counts and metadata"""
    try:
        rag_service = get_rag_service()
        return {"documents": rag_service.list_documents()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/documents/{filename}", tags=["Admin"])
async def delete_document(filename: str):
    """Remove all chunks for a document from the knowledge base"""
    try:
        rag_service = get_rag_service()
        deleted = rag_service.delete_document(filename)
        if deleted == 0:
            raise HTTPException(status_code=404, detail=f"No chunks found for '{filename}'")
        return {"status": "deleted", "filename": filename, "chunks_removed": deleted}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT)
