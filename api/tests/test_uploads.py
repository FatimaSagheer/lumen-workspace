import httpx
import pytest

from app.storage import MAX_BYTES, head_object, make_key

PDF = "application/pdf"


def ask_for_upload(user, ws, filename="notes.txt", content_type="text/plain", size=5):
    return user.request(
        "POST",
        f"/workspaces/{ws}/documents/upload-url",
        json={"filename": filename, "content_type": content_type, "size_bytes": size},
    )


def put_file(url, data: bytes, content_type="text/plain"):
    # Send the bytes straight to storage, exactly like the browser will
    return httpx.put(url, content=data, headers={"Content-Type": content_type}, timeout=30)


@pytest.fixture
def cleanup():
    """Remember documents made during a test and delete them afterwards,
    so the R2 bucket stays tidy."""
    made = []
    yield made
    for user, ws, doc_id in made:
        user.request("DELETE", f"/workspaces/{ws}/documents/{doc_id}")


def start_upload(user, ws, cleanup, filename="notes.txt", size=5):
    r = ask_for_upload(user, ws, filename, "text/plain", size)
    assert r.status_code == 201, r.text
    body = r.json()
    cleanup.append((user, ws, body["document"]["id"]))
    return body


def upload_and_complete(user, ws, cleanup, data=b"hello lumen", filename="notes.txt"):
    body = start_upload(user, ws, cleanup, filename, len(data))
    assert put_file(body["upload_url"], data).status_code == 200
    r = user.request("POST", f"/workspaces/{ws}/documents/{body['document']['id']}/complete")
    assert r.status_code == 200, r.text
    return r.json()


# ---- Step 1: asking for an upload link ----

def test_upload_url_creates_an_uploading_document(team, cleanup):
    admin, member, ws = team
    body = start_upload(member, ws, cleanup, "notes.txt", 5)
    doc = body["document"]
    assert doc["status"] == "uploading"
    assert doc["title"] == "notes.txt"
    assert doc["uploaded_by"] == member.id
    assert body["upload_url"].startswith("https://")
    assert body["expires_in"] == 300


def test_the_storage_location_is_never_exposed(team, cleanup):
    admin, member, ws = team
    doc = start_upload(member, ws, cleanup)["document"]
    assert "storage_key" not in doc


def test_disallowed_file_type_is_415(team):
    admin, member, ws = team
    r = ask_for_upload(member, ws, "virus.exe", "application/x-msdownload", 10)
    assert r.status_code == 415


def test_too_large_file_is_413(team):
    admin, member, ws = team
    r = ask_for_upload(member, ws, "big.pdf", PDF, MAX_BYTES + 1)
    assert r.status_code == 413


@pytest.mark.parametrize("size", [0, -5])
def test_size_must_be_positive(team, size):
    admin, member, ws = team
    r = ask_for_upload(member, ws, "a.txt", "text/plain", size)
    assert r.status_code == 422


def test_blank_filename_is_422(team):
    admin, member, ws = team
    r = ask_for_upload(member, ws, "   ", "text/plain", 5)
    assert r.status_code == 422


def test_outsider_cannot_ask_for_an_upload_url(team, make_user):
    admin, member, ws = team
    outsider = make_user("Outsider")
    assert ask_for_upload(outsider, ws).status_code == 404


# ---- Step 3: finishing the upload ----

def test_full_upload_flow(team, cleanup):
    admin, member, ws = team
    data = b"hello lumen"
    doc = upload_and_complete(member, ws, cleanup, data)
    assert doc["status"] == "queued"
    # the file really is in storage, under the key the SERVER chose
    info = head_object(make_key(ws, doc["id"], "notes.txt"))
    assert info is not None and info["size"] == len(data)


def test_filename_cannot_choose_where_the_file_goes(team, cleanup):
    admin, member, ws = team
    doc = upload_and_complete(member, ws, cleanup, b"x", "../../evil.txt")
    assert head_object(make_key(ws, doc["id"], "../../evil.txt")) is not None
    assert head_object("evil.txt") is None


def test_complete_before_the_file_arrives_is_409(team, cleanup):
    admin, member, ws = team
    body = start_upload(member, ws, cleanup)
    doc_id = body["document"]["id"]
    r = member.request("POST", f"/workspaces/{ws}/documents/{doc_id}/complete")
    assert r.status_code == 409
    still = member.request("GET", f"/workspaces/{ws}/documents/{doc_id}").json()
    assert still["status"] == "uploading"


def test_complete_with_the_wrong_size_is_400_and_marks_failed(team, cleanup):
    admin, member, ws = team
    body = start_upload(member, ws, cleanup, "notes.txt", 100)  # claims 100 bytes
    doc_id = body["document"]["id"]
    assert put_file(body["upload_url"], b"12345").status_code == 200  # sends 5
    r = member.request("POST", f"/workspaces/{ws}/documents/{doc_id}/complete")
    assert r.status_code == 400
    doc = member.request("GET", f"/workspaces/{ws}/documents/{doc_id}").json()
    assert doc["status"] == "failed"
    assert head_object(make_key(ws, doc_id, "notes.txt")) is None  # bad file removed


def test_complete_twice_is_409(team, cleanup):
    admin, member, ws = team
    doc = upload_and_complete(member, ws, cleanup)
    r = member.request("POST", f"/workspaces/{ws}/documents/{doc['id']}/complete")
    assert r.status_code == 409


def test_member_cannot_complete_someone_elses_upload(team, cleanup):
    admin, member, ws = team
    body = start_upload(admin, ws, cleanup)
    r = member.request("POST", f"/workspaces/{ws}/documents/{body['document']['id']}/complete")
    assert r.status_code == 403


def test_complete_through_another_workspace_is_404(team, cleanup):
    admin, member, ws = team
    body = start_upload(admin, ws, cleanup)
    other = admin.request("POST", "/workspaces", json={"name": "Other"}).json()
    r = admin.request("POST", f"/workspaces/{other['id']}/documents/{body['document']['id']}/complete")
    assert r.status_code == 404


# ---- Deleting and downloading ----

def test_deleting_a_document_also_deletes_its_file(team):
    admin, member, ws = team
    keep = []  # this test deletes by itself, so nothing is left to clean up
    doc = upload_and_complete(member, ws, keep)
    key = make_key(ws, doc["id"], "notes.txt")
    assert head_object(key) is not None
    r = member.request("DELETE", f"/workspaces/{ws}/documents/{doc['id']}")
    assert r.status_code == 204
    assert head_object(key) is None


def test_download_returns_the_same_bytes(team, cleanup):
    admin, member, ws = team
    data = b"hello lumen"
    doc = upload_and_complete(member, ws, cleanup, data)
    r = admin.request("GET", f"/workspaces/{ws}/documents/{doc['id']}/download-url")
    assert r.status_code == 200, r.text
    assert httpx.get(r.json()["url"], timeout=30).content == data


def test_download_before_the_upload_finishes_is_409(team, cleanup):
    admin, member, ws = team
    body = start_upload(member, ws, cleanup)
    r = member.request("GET", f"/workspaces/{ws}/documents/{body['document']['id']}/download-url")
    assert r.status_code == 409


def test_outsider_cannot_get_a_download_link(team, make_user, cleanup):
    admin, member, ws = team
    doc = upload_and_complete(member, ws, cleanup)
    outsider = make_user("Outsider")
    r = outsider.request("GET", f"/workspaces/{ws}/documents/{doc['id']}/download-url")
    assert r.status_code == 404