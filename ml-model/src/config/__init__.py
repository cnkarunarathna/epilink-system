import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Database configuration
DB_CONFIG = {
    "host": os.getenv("DB_HOST"),
    "port": os.getenv("DB_PORT"),
    "database": os.getenv("DB_NAME"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "sslmode": os.getenv("PGSSLMODE"),
}

# Model configuration
MODEL_PATH = "models/dengue_xgb_model.pkl"
START_DATE = "2020-01-01"
END_DATE = "2025-01-01"
