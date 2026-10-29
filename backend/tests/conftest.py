import io
import os
import sys
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import app.db.models  # noqa: F401
from app.core.auth import require_auth
from app.core.config import settings
from app.db.base import Base
from app.db.session import get_db
from app.main import app as fastapi_app


# Determine if live MySQL is reachable
def is_mysql_available() -> bool:
    try:
        test_url = settings.get_database_url(is_test=True)
        temp_engine = create_engine(
            test_url, pool_pre_ping=True, connect_args={"connect_timeout": 2}
        )
        with temp_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


MYSQL_AVAILABLE = is_mysql_available()


@pytest.fixture(scope="session")
def test_engine():
    """Create test engine pointing to dedicated MySQL test database."""
    if MYSQL_AVAILABLE:
        test_url = settings.get_database_url(is_test=True)
        engine = create_engine(test_url, pool_pre_ping=True)
        Base.metadata.create_all(bind=engine)
        yield engine
        Base.metadata.drop_all(bind=engine)
    else:
        # Note: In accordance with prompt requirements, SQLite is NOT used.
        # When live MySQL is not running on 127.0.0.1:3306, tests requiring live DB will be skipped or mocked.
        yield None


@pytest.fixture(scope="function")
def db_session(test_engine) -> Generator[Session, None, None]:
    """Provide an isolated database session per test with automatic rollback."""
    if not test_engine:
        pytest.skip(
            "Live MySQL server is not running on 127.0.0.1:3306. Start MySQL via docker-compose to run integration tests."
        )

    connection = test_engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, expire_on_commit=False)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def client(db_session) -> Generator[TestClient, None, None]:
    """TestClient configured with overridden database session and authenticated identity."""

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    fastapi_app.dependency_overrides[get_db] = override_get_db
    fastapi_app.dependency_overrides[require_auth] = lambda: {
        "sub": "test_member@workspace.local",
        "role": "workspace_member",
    }
    with TestClient(fastapi_app) as test_client:
        yield test_client
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def unauthenticated_client() -> TestClient:
    """Standard TestClient using default app dependencies without DB override."""
    return TestClient(fastapi_app)


# --- File Fixtures for Testing Ingestion ---


@pytest.fixture
def sample_txt_bytes() -> bytes:
    content = (
        "Priya: We need to finalize the API schema by next Friday.\n"
        "Rahul: I will take ownership of the database migration.\n"
        "Sarah: Are we supporting MySQL 8? Yes, confirmed."
    )
    return content.encode("utf-8")


@pytest.fixture
def sample_docx_bytes() -> bytes:
    import docx

    doc = docx.Document()
    doc.add_heading("Sprint Planning Notes", level=1)
    doc.add_paragraph("Priya: Review the client action tracker architecture.")
    doc.add_paragraph("Rahul: Complete PyMySQL integration tests by Monday.")
    bio = io.BytesIO()
    doc.save(bio)
    return bio.getvalue()


@pytest.fixture
def sample_pdf_bytes() -> bytes:
    from pypdf import PdfWriter

    writer = PdfWriter()
    # Create a minimal text-based page using PdfWriter annotations/streams
    writer.add_blank_page(width=612, height=792)
    bio = io.BytesIO()
    writer.write(bio)
    # Return minimal valid PDF bytes
    return bio.getvalue()


@pytest.fixture
def sample_vtt_bytes() -> bytes:
    vtt = (
        "WEBVTT - Meeting Sync\n\n"
        "00:00:01.000 --> 00:00:04.000\n"
        "<v Priya>We agreed to ship the export feature on 15 Nov.</v>\n\n"
        "00:00:05.000 --> 00:00:08.000\n"
        "<v Rahul>I will write the unit tests for exports.</v>\n"
    )
    return vtt.encode("utf-8")


@pytest.fixture
def sample_srt_bytes() -> bytes:
    srt = (
        "1\n"
        "00:00:01,000 --> 00:00:04,000\n"
        "Priya: The client requested Excel and Word minutes.\n\n"
        "2\n"
        "00:00:05,000 --> 00:00:08,000\n"
        "Rahul: Roger that, implementing now.\n"
    )
    return srt.encode("utf-8")
