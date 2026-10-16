import uuid

from fastapi.testclient import TestClient

from app.main import app

# "with" runs the app's startup, so the database pool opens.
# TestClient re-raises any crash inside the endpoint, so the REAL error prints here.
with TestClient(app) as c:
    email = f"debug-{uuid.uuid4().hex[:8]}@test.com"
    r = c.post("/auth/signup", json={"email": email, "password": "password123", "name": "Debug"})
    print("signup:", r.status_code)
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    ws = c.get("/auth/me", headers=headers).json()["workspaces"][0]["id"]

    r = c.post(
        f"/workspaces/{ws}/documents/upload-url",
        headers=headers,
        json={"filename": "notes.txt", "content_type": "text/plain", "size_bytes": 5},
    )
    print("upload-url:", r.status_code)
    print(r.text[:400])