from fastapi.testclient import TestClient


def test_create_client_success(client: TestClient):
    """Test creating a valid client organization."""
    payload = {"name": "Test Acme Corp"}
    response = client.post("/clients", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "id" in data
    assert data["name"] == "Test Acme Corp"
    assert "created_at" in data


def test_create_client_duplicate_name_rejected(client: TestClient):
    """Test that duplicate normalized client names are rejected with HTTP 409."""
    client.post("/clients", json={"name": "Pied Piper"})

    # Try duplicate with differing case and surrounding spaces
    duplicate_res = client.post("/clients", json={"name": "  pied piper  "})
    assert duplicate_res.status_code == 409
    assert duplicate_res.json()["code"] == "DUPLICATE_ENTITY"


def test_create_client_empty_name_rejected(client: TestClient):
    """Test that empty or whitespace-only client names are rejected with HTTP 422."""
    res1 = client.post("/clients", json={"name": ""})
    assert res1.status_code == 422

    res2 = client.post("/clients", json={"name": "   "})
    assert res2.status_code == 422


def test_list_clients(client: TestClient):
    """Test listing client organizations with pagination."""
    client.post("/clients", json={"name": "Alpha Corp"})
    client.post("/clients", json={"name": "Beta LLC"})

    response = client.get("/clients")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] >= 2
    names = [c["name"] for c in data["items"]]
    assert "Alpha Corp" in names
    assert "Beta LLC" in names


def test_get_client_by_id(client: TestClient):
    """Test retrieving an existing client by its UUID."""
    create_res = client.post("/clients", json={"name": "Omega Systems"})
    client_id = create_res.json()["id"]

    get_res = client.get(f"/clients/{client_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == client_id
    assert get_res.json()["name"] == "Omega Systems"


def test_get_missing_client_404(client: TestClient):
    """Test that requesting a non-existent client returns HTTP 404."""
    response = client.get("/clients/non-existent-uuid-12345")
    assert response.status_code == 404
    assert response.json()["code"] == "NOT_FOUND"
