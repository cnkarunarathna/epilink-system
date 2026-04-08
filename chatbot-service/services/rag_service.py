"""RAG Service with Qdrant and Gemini API"""

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    VectorParams,
)
import google.generativeai as genai
from pypdf import PdfReader

from config import (
    DATA_DIR,
    GEMINI_API_KEY,
    MANIFEST_FILE,
    QDRANT_COLLECTION_NAME,
    QDRANT_URL,
    QDRANT_VECTOR_SIZE,
)


def _load_manifest() -> dict[str, dict]:
    """Load documents_manifest.json and return a filename→metadata dict."""
    if not os.path.exists(MANIFEST_FILE):
        return {}
    with open(MANIFEST_FILE, "r") as f:
        data = json.load(f)
    return {doc["filename"]: doc for doc in data.get("documents", [])}


class RAGService:
    """Retrieval-Augmented Generation service for dengue information"""

    def __init__(self):
        # Initialize Gemini
        if GEMINI_API_KEY:
            genai.configure(api_key=GEMINI_API_KEY)
            self.model = genai.GenerativeModel("gemini-2.5-flash")
            self.embedding_model = "models/text-embedding-004"
        else:
            self.model = None
            self.embedding_model = None

        # Initialize Qdrant client
        self.qdrant = QdrantClient(url=QDRANT_URL)
        self._ensure_collection()

    def _ensure_collection(self):
        """Create the collection if it doesn't already exist."""
        existing = {c.name for c in self.qdrant.get_collections().collections}
        if QDRANT_COLLECTION_NAME not in existing:
            self.qdrant.create_collection(
                collection_name=QDRANT_COLLECTION_NAME,
                vectors_config=VectorParams(
                    size=QDRANT_VECTOR_SIZE,
                    distance=Distance.COSINE,
                ),
            )

    def _get_embedding(self, text: str) -> list[float]:
        """Generate embedding using Gemini text-embedding-004."""
        if not GEMINI_API_KEY:
            return [0.0] * QDRANT_VECTOR_SIZE

        result = genai.embed_content(
            model=self.embedding_model,
            content=text,
            task_type="retrieval_document",
        )
        return result["embedding"]

    def _chunk_text(self, text: str, chunk_size: int = 1000, overlap: int = 200) -> list[str]:
        """Split text into overlapping chunks."""
        chunks = []
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunk = text[start:end]
            if chunk.strip():
                chunks.append(chunk.strip())
            start = end - overlap
        return chunks

    def _point_id(self, filename: str, chunk_index: int) -> str:
        """Generate a deterministic UUID from filename + chunk index."""
        return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{filename}:{chunk_index}"))

    def _is_already_ingested(self, filename: str) -> bool:
        """Check if at least one chunk from this file exists in Qdrant."""
        results = self.qdrant.scroll(
            collection_name=QDRANT_COLLECTION_NAME,
            scroll_filter=Filter(
                must=[FieldCondition(key="source", match=MatchValue(value=filename))]
            ),
            limit=1,
            with_payload=False,
            with_vectors=False,
        )
        return len(results[0]) > 0

    def ingest_pdf(self, pdf_path: str, manifest: dict[str, dict] | None = None) -> int:
        """Ingest a PDF file into Qdrant with metadata from manifest."""
        reader = PdfReader(pdf_path)
        filename = os.path.basename(pdf_path)
        doc_meta = (manifest or {}).get(filename, {})

        all_text = ""
        for page in reader.pages:
            text = page.extract_text()
            if text:
                all_text += text + "\n"

        chunks = self._chunk_text(all_text)
        points = []
        ingested_at = datetime.now(timezone.utc).isoformat()

        for i, chunk in enumerate(chunks):
            embedding = self._get_embedding(chunk)
            points.append(
                PointStruct(
                    id=self._point_id(filename, i),
                    vector=embedding,
                    payload={
                        "source": filename,
                        "document_title": doc_meta.get("title", filename),
                        "category": doc_meta.get("category", "general"),
                        "language": doc_meta.get("language", "en"),
                        "doc_source": doc_meta.get("source", "Unknown"),
                        "chunk_index": i,
                        "text": chunk,
                        "ingested_at": ingested_at,
                    },
                )
            )

        # Upsert in batches of 100
        batch_size = 100
        for batch_start in range(0, len(points), batch_size):
            self.qdrant.upsert(
                collection_name=QDRANT_COLLECTION_NAME,
                points=points[batch_start: batch_start + batch_size],
            )

        return len(chunks)

    def ingest_all_pdfs(self) -> dict:
        """Ingest all PDFs from the data directory, skipping already-ingested files."""
        results = {}
        if not os.path.exists(DATA_DIR):
            return {"error": f"Data directory {DATA_DIR} not found"}

        manifest = _load_manifest()

        for filename in os.listdir(DATA_DIR):
            if not filename.lower().endswith(".pdf"):
                continue
            if self._is_already_ingested(filename):
                results[filename] = {"status": "skipped", "reason": "already ingested"}
                continue
            pdf_path = os.path.join(DATA_DIR, filename)
            try:
                chunks_count = self.ingest_pdf(pdf_path, manifest)
                results[filename] = {"status": "success", "chunks": chunks_count}
            except Exception as e:
                results[filename] = {"status": "error", "message": str(e)}

        return results

    def delete_document(self, filename: str) -> int:
        """Delete all chunks for a given source file. Returns deleted point count."""
        # Collect all point IDs for this file
        point_ids = []
        offset = None
        while True:
            batch, offset = self.qdrant.scroll(
                collection_name=QDRANT_COLLECTION_NAME,
                scroll_filter=Filter(
                    must=[FieldCondition(key="source", match=MatchValue(value=filename))]
                ),
                limit=100,
                offset=offset,
                with_payload=False,
                with_vectors=False,
            )
            point_ids.extend([p.id for p in batch])
            if offset is None:
                break

        if point_ids:
            self.qdrant.delete(
                collection_name=QDRANT_COLLECTION_NAME,
                points_selector=point_ids,
            )

        return len(point_ids)

    def list_documents(self) -> list[dict]:
        """List all ingested documents with their chunk counts and metadata."""
        manifest = _load_manifest()
        counts: dict[str, dict] = {}

        offset = None
        while True:
            batch, offset = self.qdrant.scroll(
                collection_name=QDRANT_COLLECTION_NAME,
                limit=100,
                offset=offset,
                with_payload=["source", "document_title", "category", "language", "doc_source", "ingested_at"],
                with_vectors=False,
            )
            for point in batch:
                src = point.payload.get("source", "unknown")
                if src not in counts:
                    counts[src] = {
                        "source": src,
                        "document_title": point.payload.get("document_title", src),
                        "category": point.payload.get("category", "general"),
                        "language": point.payload.get("language", "en"),
                        "doc_source": point.payload.get("doc_source", "Unknown"),
                        "ingested_at": point.payload.get("ingested_at"),
                        "chunk_count": 0,
                    }
                counts[src]["chunk_count"] += 1
            if offset is None:
                break

        return list(counts.values())

    def query(self, question: str, n_results: int = 3, category: str | None = None) -> dict:
        """Query the knowledge base and generate a response."""
        query_embedding = self._get_embedding(question)

        search_filter = None
        if category:
            search_filter = Filter(
                must=[FieldCondition(key="category", match=MatchValue(value=category))]
            )

        hits = self.qdrant.search(
            collection_name=QDRANT_COLLECTION_NAME,
            query_vector=query_embedding,
            limit=n_results,
            query_filter=search_filter,
            with_payload=True,
        )

        context_parts = []
        sources = []

        for hit in hits:
            text = hit.payload.get("text", "")
            title = hit.payload.get("document_title", hit.payload.get("source", "Unknown"))
            context_parts.append(f"[Source: {title}]\n{text}")
            sources.append({
                "title": title,
                "snippet": text[:200] + "..." if len(text) > 200 else text,
            })

        context = "\n\n".join(context_parts)

        if not self.model:
            return {
                "response": self._get_fallback_response(question),
                "sources": sources,
                "note": "Running without Gemini API key - using fallback responses",
            }

        prompt = f"""You are EpiBot, a helpful assistant specializing in dengue fever information for Sri Lanka.
Use the following context to answer the user's question. If the context doesn't contain relevant information,
provide general dengue-related knowledge.

Context:
{context if context else "No specific context available."}

User Question: {question}

Provide a helpful, accurate, and concise response. If discussing symptoms or treatment,
always recommend consulting a healthcare professional."""

        try:
            response = self.model.generate_content(prompt)
            return {
                "response": response.text,
                "sources": sources,
            }
        except Exception as e:
            return {
                "response": f"I encountered an error: {str(e)}. Please try again.",
                "sources": sources,
            }

    def _get_fallback_response(self, question: str) -> str:
        """Provide fallback responses when Gemini API is not available."""
        question_lower = question.lower()

        if "symptom" in question_lower:
            return (
                "Common dengue symptoms include: high fever (40°C/104°F), severe headache, "
                "pain behind the eyes, muscle and joint pains, nausea, vomiting, swollen glands, "
                "and skin rash. If you experience these symptoms, please consult a doctor immediately."
            )
        elif "prevent" in question_lower or "avoid" in question_lower:
            return (
                "To prevent dengue: 1) Eliminate standing water where mosquitoes breed, "
                "2) Use mosquito repellents, 3) Wear long-sleeved clothes, 4) Use mosquito nets, "
                "5) Keep windows and doors screened, 6) Report potential breeding sites to authorities."
            )
        elif "treatment" in question_lower or "cure" in question_lower:
            return (
                "There is no specific antiviral treatment for dengue. Treatment is supportive: "
                "rest, drink plenty of fluids, take paracetamol for fever and pain. "
                "AVOID aspirin and ibuprofen as they can increase bleeding risk. "
                "Seek immediate medical care if symptoms worsen."
            )
        elif "risk" in question_lower or "danger" in question_lower:
            return (
                "Dengue is most dangerous when it progresses to severe dengue (dengue hemorrhagic fever). "
                "Warning signs include: severe abdominal pain, persistent vomiting, rapid breathing, "
                "bleeding gums, blood in vomit, fatigue and restlessness. Seek emergency care immediately."
            )
        else:
            return (
                "I'm EpiBot, your dengue information assistant. I can help you with:\n"
                "• Dengue symptoms and warning signs\n"
                "• Prevention tips and mosquito control\n"
                "• Treatment guidelines\n"
                "• Risk factors and when to seek medical help\n\n"
                "What would you like to know about dengue?"
            )

    def get_collection_stats(self) -> dict:
        """Get statistics about the knowledge base."""
        info = self.qdrant.get_collection(QDRANT_COLLECTION_NAME)
        return {
            "collection_name": QDRANT_COLLECTION_NAME,
            "document_count": info.points_count,
            "qdrant_url": QDRANT_URL,
        }


# Singleton instance
_rag_service: Optional[RAGService] = None


def get_rag_service() -> RAGService:
    """Get or create RAG service instance."""
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service
