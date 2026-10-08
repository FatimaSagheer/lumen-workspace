import os
import uuid

import httpx
import pytest

BASE_URL = os.getenv("API_URL", "http://localhost:8000")


@pytest.fixture(scope="session")
def client():
    # One HTTP client for the whole test run, pointed at the running API
    with httpx.Client(base_url=BASE_URL, timeout=10) as c:
        yield c


class User:
    """A logged-in test user with a convenient request() method."""

    def __init__(self, client, email, tokens):
        self.client = client
        self.email = email
        self.headers = {"Authorization": f"Bearer {tokens['access_token']}"}
        me = client.get("/auth/me", headers=self.headers).json()
        self.id = me["id"]
        self.workspace_id = me["workspaces"][0]["id"]

    def request(self, method, path, **kwargs):
        return self.client.request(method, path, headers=self.headers, **kwargs)


@pytest.fixture
def make_user(client):
    # A factory: each call signs up a brand new user with a random email
    def _make(name="Test"):
        email = f"{name.lower()}-{uuid.uuid4().hex[:8]}@test.com"
        r = client.post(
            "/auth/signup",
            json={"email": email, "password": "password123", "name": name},
        )
        assert r.status_code == 201, r.text
        return User(client, email, r.json())

    return _make


@pytest.fixture
def team(make_user):
    # An admin and a plain member who share one workspace
    admin = make_user("Admin")
    member = make_user("Member")
    ws = admin.workspace_id
    r = admin.request(
        "POST", f"/workspaces/{ws}/invites", json={"email": member.email, "role": "member"}
    )
    assert r.status_code == 201, r.text
    r = member.request("POST", "/invites/accept", json={"token": r.json()["invite_token"]})
    assert r.status_code == 200, r.text
    return admin, member, ws