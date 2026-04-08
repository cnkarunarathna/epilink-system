"""EpiBot - RAG Chatbot Service for Dengue Information"""

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Optional

import structlog
from fastapi import Depends, FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from services import (
    get_rag_service,
    create_session,
    delete_session,
    cleanup_expired_sessions,
    active_sessions_count,
    validate_startup,
)
from config import ADMIN_API_KEY, HOST, PORT, RATE_LIMIT_PER_MINUTE


# ── Structured logging setup ──────────────────────────────────────────────────

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.BoundLogger,
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)

log = structlog.get_logger(__name__)

# Suppress noisy uvicorn access logs (structlog handles our own events)
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


# ── Rate limiter ──────────────────────────────────────────────────────────────

limiter = Limiter(key_func=get_remote_address, default_limits=[])


# ── Lifespan ──────────────────────────────────────────────────────────────────

async def _session_cleanup_loop():
    """Background task: evict sessions inactive for longer than SESSION_TTL_MINUTES."""
    while True:
        await asyncio.sleep(60)
        removed = cleanup_expired_sessions()
        if removed:
            log.info("sessions_expired", count=removed)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("service_starting", service="epibot-rag")

    # Validate environment before accepting requests — raises on hard failures
    validate_startup()

    rag_service = get_rag_service()
    results = rag_service.ingest_all_pdfs()
    if results:
        log.info("ingestion_complete", results=results)
    else:
        log.info("ingestion_skipped", reason="no PDFs in data directory")

    stats = rag_service.get_collection_stats()
    log.info("knowledge_base_ready", document_chunks=stats["document_count"])

    cleanup_task = asyncio.create_task(_session_cleanup_loop())
    yield
    cleanup_task.cancel()
    log.info("service_stopping", service="epibot-rag")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="EpiBot RAG Service",
    description="Retrieval-Augmented Generation chatbot for dengue information",
    version="5.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Admin key dependency ──────────────────────────────────────────────────────

async def require_admin_key(x_admin_key: Optional[str] = Header(default=None)):
    """
    Enforces X-Admin-Key header when ADMIN_API_KEY is configured.
    In dev (ADMIN_API_KEY unset), admin endpoints are open.
    """
    if ADMIN_API_KEY and x_admin_key != ADMIN_API_KEY:
        raise HTTPException(
            status_code=403,
            detail={
                "error_code": "FORBIDDEN",
                "message": "Invalid or missing X-Admin-Key header.",
                "suggestion": "Provide the correct admin API key in the X-Admin-Key request header.",
            },
        )


# ── Request / Response models ─────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    category: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    sources: list[dict] = []
    confidence: Optional[str] = None   # "high" | "medium" | "low"
    note: Optional[str] = None


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
        log.error("health_check_failed", error=str(e))
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": "QDRANT_ERROR",
                "message": "Could not retrieve collection stats.",
                "suggestion": "Check that Qdrant is reachable.",
            },
        )


@app.post("/chat", response_model=ChatResponse, tags=["Chat"])
@limiter.limit(f"{RATE_LIMIT_PER_MINUTE}/minute")
async def chat(request: Request, body: ChatRequest):
    """Send a message and get an AI-powered response. Pass session_id for multi-turn conversations."""
    if not body.message.strip():
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": "EMPTY_MESSAGE",
                "message": "Message cannot be empty.",
                "suggestion": "Provide a non-empty message in the 'message' field.",
            },
        )
    try:
        rag_service = get_rag_service()
        result = await rag_service.query(
            body.message,
            category=body.category,
            session_id=body.session_id,
        )
        return ChatResponse(**result)
    except Exception as e:
        log.error("chat_endpoint_error", error=str(e))
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred while processing your request.",
                "suggestion": "Try again. If the problem persists, contact support.",
            },
        )


@app.post("/session", response_model=SessionResponse, tags=["Session"])
async def start_session():
    """Create a new conversation session. Returns a session_id to pass with subsequent /chat requests."""
    session_id = create_session()
    return {"session_id": session_id}


@app.delete("/session/{session_id}", tags=["Session"])
async def end_session(session_id: str):
    """Explicitly end a session and discard its conversation history."""
    if not delete_session(session_id):
        raise HTTPException(
            status_code=404,
            detail={
                "error_code": "SESSION_NOT_FOUND",
                "message": f"Session '{session_id}' not found.",
                "suggestion": "The session may have already expired or been deleted.",
            },
        )
    return {"status": "deleted", "session_id": session_id}


@app.post("/ingest", response_model=IngestResponse, tags=["Admin"])
async def ingest_pdfs(_: None = Depends(require_admin_key)):
    """Ingest all PDFs from the data directory into Qdrant (skips already-ingested files)"""
    try:
        rag_service = get_rag_service()
        results = rag_service.ingest_all_pdfs()
        return {"status": "completed", "results": results}
    except Exception as e:
        log.error("ingest_endpoint_error", error=str(e))
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": "INGESTION_ERROR",
                "message": "Ingestion failed.",
                "suggestion": "Check the data directory and Qdrant connectivity.",
            },
        )


@app.get("/documents", tags=["Admin"])
async def list_documents(_: None = Depends(require_admin_key)):
    """List all ingested documents with chunk counts and metadata"""
    try:
        rag_service = get_rag_service()
        return {"documents": rag_service.list_documents()}
    except Exception as e:
        log.error("list_documents_error", error=str(e))
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": "QDRANT_ERROR",
                "message": "Failed to list documents.",
                "suggestion": "Check Qdrant connectivity.",
            },
        )


@app.delete("/documents/{filename}", tags=["Admin"])
async def delete_document(filename: str, _: None = Depends(require_admin_key)):
    """Remove all chunks for a document from the knowledge base"""
    try:
        rag_service = get_rag_service()
        deleted = rag_service.delete_document(filename)
        if deleted == 0:
            raise HTTPException(
                status_code=404,
                detail={
                    "error_code": "DOCUMENT_NOT_FOUND",
                    "message": f"No chunks found for '{filename}'.",
                    "suggestion": "Check the filename matches an ingested document (use GET /documents).",
                },
            )
        return {"status": "deleted", "filename": filename, "chunks_removed": deleted}
    except HTTPException:
        raise
    except Exception as e:
        log.error("delete_document_error", filename=filename, error=str(e))
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": "QDRANT_ERROR",
                "message": "Failed to delete document.",
                "suggestion": "Check Qdrant connectivity.",
            },
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT)
