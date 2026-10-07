def new_doc(user, ws, title="Doc"):
    r = user.request(
        "POST", f"/workspaces/{ws}/documents", json={"title": title, "source_type": "upload"}
    )
    assert r.status_code == 201, r.text
    return r.json()


# ---- Create ----

def test_create_document(team):
    admin, member, ws = team
    doc = new_doc(member, ws, "Q3 report")
    assert doc["status"] == "queued"
    assert doc["title"] == "Q3 report"
    assert doc["uploaded_by"] == member.id


def test_url_document_needs_a_url(team):
    admin, member, ws = team
    r = member.request(
        "POST", f"/workspaces/{ws}/documents", json={"title": "x", "source_type": "url"}
    )
    assert r.status_code == 422


# ---- Get one ----

def test_member_can_get_a_document(team):
    admin, member, ws = team
    doc = new_doc(admin, ws)
    r = member.request("GET", f"/workspaces/{ws}/documents/{doc['id']}")
    assert r.status_code == 200
    assert r.json()["id"] == doc["id"]


def test_unknown_document_is_404(team):
    admin, member, ws = team
    r = member.request("GET", f"/workspaces/{ws}/documents/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404


def test_document_is_hidden_from_other_workspaces(team):
    admin, member, ws = team
    doc = new_doc(admin, ws)
    other = admin.request("POST", "/workspaces", json={"name": "Other"}).json()
    # Real document id, but asked for through the wrong workspace: must not leak
    r = admin.request("GET", f"/workspaces/{other['id']}/documents/{doc['id']}")
    assert r.status_code == 404


def test_outsider_cannot_see_documents(team, make_user):
    admin, member, ws = team
    doc = new_doc(admin, ws)
    outsider = make_user("Outsider")
    assert outsider.request("GET", f"/workspaces/{ws}/documents").status_code == 404
    assert outsider.request("GET", f"/workspaces/{ws}/documents/{doc['id']}").status_code == 404


# ---- Delete ----

def test_member_cannot_delete_someone_elses_document(team):
    admin, member, ws = team
    doc = new_doc(admin, ws)
    r = member.request("DELETE", f"/workspaces/{ws}/documents/{doc['id']}")
    assert r.status_code == 403


def test_member_can_delete_own_document(team):
    admin, member, ws = team
    doc = new_doc(member, ws)
    r = member.request("DELETE", f"/workspaces/{ws}/documents/{doc['id']}")
    assert r.status_code == 204
    r = member.request("GET", f"/workspaces/{ws}/documents/{doc['id']}")
    assert r.status_code == 404


def test_admin_can_delete_a_members_document(team):
    admin, member, ws = team
    doc = new_doc(member, ws)
    r = admin.request("DELETE", f"/workspaces/{ws}/documents/{doc['id']}")
    assert r.status_code == 204


def test_deleting_twice_gives_404(team):
    admin, member, ws = team
    doc = new_doc(admin, ws)
    assert admin.request("DELETE", f"/workspaces/{ws}/documents/{doc['id']}").status_code == 204
    assert admin.request("DELETE", f"/workspaces/{ws}/documents/{doc['id']}").status_code == 404


def test_outsider_cannot_delete(team, make_user):
    admin, member, ws = team
    doc = new_doc(admin, ws)
    outsider = make_user("Outsider")
    r = outsider.request("DELETE", f"/workspaces/{ws}/documents/{doc['id']}")
    assert r.status_code == 404