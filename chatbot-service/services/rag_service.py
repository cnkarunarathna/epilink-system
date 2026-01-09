"""RAG Service with ChromaDB and Gemini API"""

import os
from typing import Optional
import chromadb
from chromadb.config import Settings
import google.generativeai as genai
from pypdf import PdfReader

from config import GEMINI_API_KEY, CHROMA_PERSIST_DIR, COLLECTION_NAME, DATA_DIR


class RAGService:
    """Retrieval-Augmented Generation service for dengue information"""

    def __init__(self):
        # Initialize Gemini
        if GEMINI_API_KEY:
            genai.configure(api_key=GEMINI_API_KEY)
            self.model = genai.GenerativeModel("gemini-1.5-flash")
            self.embedding_model = "models/text-embedding-004"
        else:
            self.model = None
            self.embedding_model = None

        # Initialize ChromaDB
        self.chroma_client = chromadb.PersistentClient(
            path=CHROMA_PERSIST_DIR,
            settings=Settings(anonymized_telemetry=False),
        )
        self.collection = self.chroma_client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"description": "Dengue knowledge base"},
        )

    def _get_embedding(self, text: str) -> list[float]:
        """Generate embedding using Gemini"""
        if not GEMINI_API_KEY:
            # Return dummy embedding for testing without API key
            return [0.0] * 768

        result = genai.embed_content(
            model=self.embedding_model,
            content=text,
            task_type="retrieval_document",
        )
        return result["embedding"]

    def _chunk_text(self, text: str, chunk_size: int = 1000, overlap: int = 200) -> list[str]:
        """Split text into overlapping chunks"""
        chunks = []
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunk = text[start:end]
            if chunk.strip():
                chunks.append(chunk.strip())
            start = end - overlap
        return chunks

    def ingest_pdf(self, pdf_path: str) -> int:
        """Ingest a PDF file into ChromaDB"""
        reader = PdfReader(pdf_path)
        filename = os.path.basename(pdf_path)

        all_text = ""
        for page in reader.pages:
            text = page.extract_text()
            if text:
                all_text += text + "\n"

        chunks = self._chunk_text(all_text)

        for i, chunk in enumerate(chunks):
            doc_id = f"{filename}_{i}"
            embedding = self._get_embedding(chunk)

            self.collection.upsert(
                ids=[doc_id],
                embeddings=[embedding],
                documents=[chunk],
                metadatas=[{"source": filename, "chunk_index": i}],
            )

        return len(chunks)

    def ingest_all_pdfs(self) -> dict:
        """Ingest all PDFs from the data directory"""
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
        """Query the knowledge base and generate a response"""
        # Get query embedding
        query_embedding = self._get_embedding(question)

        # Search ChromaDB
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            include=["documents", "metadatas"],
        )

        # Extract context from results
        context_parts = []
        sources = []

        if results["documents"] and results["documents"][0]:
            for i, doc in enumerate(results["documents"][0]):
                context_parts.append(doc)
                if results["metadatas"] and results["metadatas"][0]:
                    sources.append({
                        "title": results["metadatas"][0][i].get("source", "Unknown"),
                        "snippet": doc[:200] + "..." if len(doc) > 200 else doc,
                    })

        context = "\n\n".join(context_parts)

        # Generate response with Gemini
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
        """Provide fallback responses when Gemini API is not available"""
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
        """Get statistics about the knowledge base"""
        return {
            "collection_name": COLLECTION_NAME,
            "document_count": self.collection.count(),
            "persist_directory": CHROMA_PERSIST_DIR,
        }


# Singleton instance
_rag_service: Optional[RAGService] = None


def get_rag_service() -> RAGService:
    """Get or create RAG service instance"""
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service
