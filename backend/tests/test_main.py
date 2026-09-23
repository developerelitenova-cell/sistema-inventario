from fastapi.testclient import TestClient
from main import app

def test_ping_auth(client: TestClient):
    response = client.get("/ping-auth")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
