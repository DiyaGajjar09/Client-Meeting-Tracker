import json
import os

from dotenv import load_dotenv
from sqlalchemy.engine import URL

# Load .env file if available
load_dotenv()


class Settings:
    """Centralized configuration loaded from environment variables."""

    APP_ENV: str = os.getenv("APP_ENV", "development")
    APP_NAME: str = os.getenv("APP_NAME", "Client Meeting-to-Action Tracker")
    APP_VERSION: str = os.getenv("APP_VERSION", "0.1.0")
    DEBUG: bool = os.getenv("DEBUG", "True").lower() in ("true", "1", "t")

    # Authentication & Access Control (v1.0 PRD: single shared password or hosting SSO)
    AUTH_ENABLED: bool = os.getenv("AUTH_ENABLED", "True").lower() in ("true", "1", "t")
    APP_SHARED_PASSWORD: str = os.getenv("APP_SHARED_PASSWORD", "meeting_secure_pass_2026")
    API_SECRET_KEY: str = os.getenv(
        "API_SECRET_KEY", "cmtat_secret_jwt_hmac_signing_key_change_in_production"
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24h

    # Rate Limiting & DoS Protection
    RATE_LIMIT_ENABLED: bool = os.getenv("RATE_LIMIT_ENABLED", "True").lower() in ("true", "1", "t")
    RATE_LIMIT_LOGIN: int = int(os.getenv("RATE_LIMIT_LOGIN", "10"))  # 10 req/min
    RATE_LIMIT_MEETINGS: int = int(os.getenv("RATE_LIMIT_MEETINGS", "30"))  # 30 req/min
    RATE_LIMIT_EXTRACT: int = int(os.getenv("RATE_LIMIT_EXTRACT", "15"))  # 15 req/min
    RATE_LIMIT_EXPORT: int = int(os.getenv("RATE_LIMIT_EXPORT", "30"))  # 30 req/min

    # Database Configuration (MySQL 8.0+)
    DB_HOST: str = os.getenv("DB_HOST", "127.0.0.1")
    DB_PORT: int = int(os.getenv("DB_PORT", "3306"))
    DB_NAME: str = os.getenv("DB_NAME", "meeting_action_tracker")
    DB_USER: str = os.getenv("DB_USER", "meeting_app")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "change_this_password")
    TEST_DB_NAME: str = os.getenv("TEST_DB_NAME", "meeting_action_tracker_test")

    # Ingestion constraints
    MAX_PASTED_TEXT_CHARS: int = int(os.getenv("MAX_PASTED_TEXT_CHARS", "150000"))
    MAX_UPLOAD_BYTES: int = int(os.getenv("MAX_UPLOAD_BYTES", "10485760"))  # 10 MB
    RETENTION_DAYS: int = int(os.getenv("RETENTION_DAYS", "90"))

    # AI / LLM Configuration (Google Gemini)
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "gemini")
    LLM_TIMEOUT_SECONDS: int = int(os.getenv("LLM_TIMEOUT_SECONDS", "60"))
    LLM_MAX_RETRIES: int = int(os.getenv("LLM_MAX_RETRIES", "2"))
    LLM_TEMPERATURE: float = float(os.getenv("LLM_TEMPERATURE", "0.1"))
    CHUNK_TARGET_TOKENS: int = int(os.getenv("CHUNK_TARGET_TOKENS", "6000"))
    CHUNK_OVERLAP_TOKENS: int = int(os.getenv("CHUNK_OVERLAP_TOKENS", "500"))
    QUOTE_MATCH_MIN_RATIO: float = float(os.getenv("QUOTE_MATCH_MIN_RATIO", "0.85"))
    PROMPT_VERSION: str = os.getenv("PROMPT_VERSION", "v1.0")
    NEXT_WEEKDAY_CONVENTION: str = os.getenv("NEXT_WEEKDAY_CONVENTION", "following_week")

    # Duplicate detection thresholds (scikit-learn TF-IDF cosine similarity)
    DUPLICATE_LIKELY_THRESHOLD: float = float(os.getenv("DUPLICATE_LIKELY_THRESHOLD", "0.80"))
    DUPLICATE_POSSIBLE_THRESHOLD: float = float(os.getenv("DUPLICATE_POSSIBLE_THRESHOLD", "0.60"))

    @property
    def has_gemini_key(self) -> bool:
        """Check if a Gemini API key is configured without exposing it."""
        return bool(self.GEMINI_API_KEY and self.GEMINI_API_KEY.strip())

    # CORS origins
    _cors_raw = os.getenv(
        "CORS_ORIGINS",
        '["http://localhost:5173","http://127.0.0.1:5173","http://localhost:5174","http://127.0.0.1:5174","http://localhost:5175","http://127.0.0.1:5175"]',
    )
    try:
        CORS_ORIGINS: list[str] = json.loads(_cors_raw) if _cors_raw else ["*"]
    except (json.JSONDecodeError, TypeError):
        CORS_ORIGINS: list[str] = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            "http://localhost:5175",
            "http://127.0.0.1:5175",
        ]

    def get_database_url(self, is_test: bool = False) -> URL:
        """Construct a safe SQLAlchemy MySQL connection URL using PyMySQL driver."""
        db_name = self.TEST_DB_NAME if is_test else self.DB_NAME
        return URL.create(
            drivername="mysql+pymysql",
            username=self.DB_USER,
            password=self.DB_PASSWORD,
            host=self.DB_HOST,
            port=self.DB_PORT,
            database=db_name,
            query={"charset": "utf8mb4"},
        )

    def get_safe_database_url_str(self, is_test: bool = False) -> str:
        """Return the connection string with the password masked for logs or status checks."""
        url = self.get_database_url(is_test=is_test)
        # Render with masked password
        return url.render_as_string(hide_password=True)


settings = Settings()
