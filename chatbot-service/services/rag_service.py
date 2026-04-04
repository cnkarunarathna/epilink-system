"""RAG Service with Qdrant and Gemini API"""

import os
import uuid
from typing import Optional

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
)
import google.generativeai as genai
from pypdf import PdfReader

from config import (
    GEMINI_API_KEY,
    QDRANT_URL,
    QDRANT_COLLECTION_NAME,
    QDRANT_VECTOR_SIZE,
    DATA_DIR,
)


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

    def ingest_pdf(self, pdf_path: str) -> int:
        """Ingest a PDF file into Qdrant."""
        reader = PdfReader(pdf_path)
        filename = os.path.basename(pdf_path)

        all_text = ""
        for page in reader.pages:
            text = page.extract_text()
            if text:
                all_text += text + "\n"

        chunks = self._chunk_text(all_text)
        points = []

        for i, chunk in enumerate(chunks):
            embedding = self._get_embedding(chunk)
            points.append(
                PointStruct(
                    id=self._point_id(filename, i),
                    vector=embedding,
                    payload={
                        "source": filename,
                        "chunk_index": i,
                        "text": chunk,
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
        """Ingest all PDFs from the data directory."""
        results = {}
        if not os.path.exists(DATA_DIR):
            return {"error": f"Data directory {DATA_DIR} not found"}

        for filename in os.listdir(DATA_DIR):
            if filename.lower().endswith(".pdf"):
                pdf_path = os.path.join(DATA_DIR, filename)
                try:
                    chunks_count = self.ingest_pdf(pdf_path)
                    results[filename] = {"status": "success", "chunks": chunks_count}
                except Exception as e:
                    results[filename] = {"status": "error", "message": str(e)}

        return results

    def query(self, question: str, n_results: int = 3) -> dict:
        """Query the knowledge base and generate a response."""
        query_embedding = self._get_embedding(question)

        hits = self.qdrant.search(
            collection_name=QDRANT_COLLECTION_NAME,
            query_vector=query_embedding,
            limit=n_results,
            with_payload=True,
        )

        context_parts = []
        sources = []

        for hit in hits:
            text = hit.payload.get("text", "")
            context_parts.append(text)
            sources.append({
                "title": hit.payload.get("source", "Unknown"),
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
