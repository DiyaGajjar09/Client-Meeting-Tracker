from fastapi.testclient import TestClient


def test_root_endpoint(unauthenticated_client: TestClient):
    """Test the root welcome endpoint returning API discovery links."""
    response = unauthenticated_client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "version" in data
    assert data["docs_url"] == "/docs"
    assert data["health_url"] == "/health"


def test_health_endpoint_structure(unauthenticated_client: TestClient):
    """Test /health endpoint format, versioning, and MySQL engine identification."""
    response = unauthenticated_client.get("/health")
    # Response is 200 (if MySQL is running) or 503 (if MySQL service is offline in environment)
    assert response.status_code in (200, 503)
    data = response.json()

    assert "status" in data
    assert "version" in data
    assert "database" in data
    assert data["database"]["engine"] == "mysql"
    assert isinstance(data["database"]["connected"], bool)
