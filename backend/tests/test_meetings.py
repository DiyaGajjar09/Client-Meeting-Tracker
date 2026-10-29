from fastapi.testclient import TestClient


def test_create_meeting_json_success(client: TestClient):
    """Test creating a meeting from JSON with pasted transcript text."""
    # First create a client
    client_res = client.post("/clients", json={"name": "Hooli Corp"})
    client_id = client_res.json()["id"]

    meeting_payload = {
        "client_id": client_id,
        "title": "Weekly Status Sync",
        "meeting_date": "2026-10-28",
        "attendees": ["Priya", "Rahul"],
        "text": (
            "Priya: We need to finalize the API schema by next Friday.\n"
            "Rahul: I will take ownership of the database migration.\n"
        ),
    }

    res = client.post("/meetings/json", json=meeting_payload)
    assert res.status_code == 201
    data = res.json()
    assert "id" in data
    assert data["client_id"] == client_id
    assert data["title"] == "Weekly Status Sync"
    assert data["line_count"] == 2
    assert data["meeting_date"] == "2026-10-28"
    assert data["attendees"] == ["Priya", "Rahul"]


def test_create_meeting_multipart_text_success(client: TestClient):
    """Test creating a meeting via multipart form-data."""
    client_res = client.post("/clients", json={"name": "Initech Inc"})
    client_id = client_res.json()["id"]

    form_data = {
        "client_id": client_id,
        "title": "Product Architecture Review",
        "meeting_date": "2026-10-28",
        "attendees": "Alice, Bob, Charlie",
        "text": "Alice: The database must use MySQL 8.0.\nBob: Agreed.",
    }

    res = client.post("/meetings", data=form_data)
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "Product Architecture Review"
    assert "Alice" in data["attendees"]
    assert "Bob" in data["attendees"]


def test_create_meeting_invalid_client_404(client: TestClient):
    """Test that associating a meeting with a non-existent client returns HTTP 404."""
    payload = {
        "client_id": "non-existent-client-id",
        "title": "Orphan Meeting",
        "text": "Priya: Hello everyone.",
    }
    res = client.post("/meetings/json", json=payload)
    assert res.status_code == 404
    assert res.json()["code"] == "NOT_FOUND"


def test_create_meeting_empty_text_422(client: TestClient):
    """Test that an empty transcript is rejected with HTTP 422."""
    client_res = client.post("/clients", json={"name": "Soylent Corp"})
    client_id = client_res.json()["id"]

    payload = {
        "client_id": client_id,
        "title": "Empty Sync",
        "text": "     ",
    }
    res = client.post("/meetings/json", json=payload)
    assert res.status_code == 422


def test_create_meeting_oversized_text_413(client: TestClient):
    """Test that pasted text exceeding 150,000 characters is rejected with HTTP 413."""
    client_res = client.post("/clients", json={"name": "Massive Corp"})
    client_id = client_res.json()["id"]

    oversized = "Speaker: Important discussion.\n" * 6000  # >150k characters
    payload = {
        "client_id": client_id,
        "title": "Too Long Meeting",
        "text": oversized,
    }
    res = client.post("/meetings/json", json=payload)
    assert res.status_code in (413, 422)


def test_get_meeting_details(client: TestClient):
    """Test fetching a saved meeting and checking full transcript text."""
    client_res = client.post("/clients", json={"name": "Globex"})
    client_id = client_res.json()["id"]

    create_res = client.post(
        "/meetings/json",
        json={
            "client_id": client_id,
            "title": "Sprint 42",
            "text": "Sarah: Complete the task items.\nPriya: Understood.",
        },
    )
    meeting_id = create_res.json()["id"]

    get_res = client.get(f"/meetings/{meeting_id}")
    assert get_res.status_code == 200
    data = get_res.json()
    assert data["id"] == meeting_id
    assert "raw_text" in data
    assert "Sarah: Complete the task items." in data["raw_text"]
    assert data["client_name"] == "Globex"


def test_list_meetings_filter(client: TestClient):
    """Test listing meetings and filtering by client_id."""
    c1 = client.post("/clients", json={"name": "Client One"}).json()["id"]
    c2 = client.post("/clients", json={"name": "Client Two"}).json()["id"]

    client.post("/meetings/json", json={"client_id": c1, "title": "M1", "text": "Priya: A"})
    client.post("/meetings/json", json={"client_id": c2, "title": "M2", "text": "Rahul: B"})

    res_all = client.get("/meetings")
    assert res_all.status_code == 200
    assert res_all.json()["total"] >= 2

    res_filtered = client.get(f"/meetings?client_id={c1}")
    assert res_filtered.status_code == 200
    assert len(res_filtered.json()["items"]) >= 1
    assert all(m["client_id"] == c1 for m in res_filtered.json()["items"])
