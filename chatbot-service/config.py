import os
from dotenv import load_dotenv

load_dotenv()

# Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Qdrant
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_COLLECTION_NAME = os.getenv("QDRANT_COLLECTION_NAME", "dengue_knowledge")
QDRANT_VECTOR_SIZE = 768  # text-embedding-004 output dimension

# Data directory for PDFs
DATA_DIR = os.getenv("DATA_DIR", "./data")
MANIFEST_FILE = os.path.join(DATA_DIR, "documents_manifest.json")

# Service settings
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
