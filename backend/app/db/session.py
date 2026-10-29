from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.core.logging import logger

# Primary Engine for MySQL 8.0+
engine = create_engine(
    settings.get_database_url(is_test=False),
    pool_pre_ping=True,
    pool_recycle=3600,
    pool_size=10,
    max_overflow=20,
    echo=False,
)

# Thread-safe session maker
SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency for acquiring database sessions with guaranteed cleanup."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connection() -> bool:
    """Verify live connectivity to the MySQL database without leaking secrets.

    Executes SELECT 1 with pool_pre_ping verification.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except SQLAlchemyError as exc:
        logger.warning(f"Database connectivity check failed: {type(exc).__name__}")
        return False
    except Exception as exc:
        logger.warning(f"Unexpected error testing database connection: {type(exc).__name__}")
        return False
