import os
from dotenv import load_dotenv

load_dotenv()

# Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Qdrant
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_COLLECTION_NAME = os.getenv("QDRANT_COLLECTION_NAME", "dengue_knowledge")
QDRANT_VECTOR_SIZE = 3072  # gemini-embedding-001 output dimension

# RAG pipeline
RETRIEVAL_LIMIT = 6          # number of chunks to retrieve before score filtering
SCORE_THRESHOLD = 0.4        # discard chunks below this cosine similarity

# Data directory for PDFs
DATA_DIR = os.getenv("DATA_DIR", "./data")
MANIFEST_FILE = os.path.join(DATA_DIR, "documents_manifest.json")

# Session management
SESSION_TTL_MINUTES = int(os.getenv("SESSION_TTL_MINUTES", "30"))
SESSION_MAX_TURNS = 6  # max user+assistant turn pairs kept per session

# Rate limiting (requests per minute per IP on /chat)
RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "20"))

# Admin API key — if empty, admin endpoints are unprotected (dev mode)
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "")

# Service settings
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
