import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Database
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "postgresql://soc_user:soc_password@localhost:5432/soc_db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # JWT
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-secret-change-in-production")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)

    # Uploads
    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "/tmp/uploads")
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB max upload size
    ALLOWED_EXTENSIONS = {"txt", "log", "csv", "json", "gz", "ndjson"}

    # OpenAI
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

    # VirusTotal (optional)
    VIRUSTOTAL_API_KEY = os.getenv("VIRUSTOTAL_API_KEY")
