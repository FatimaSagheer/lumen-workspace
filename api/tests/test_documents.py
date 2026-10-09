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

# ---- Rename ----

def test_uploader_can_rename_own_document(team):
    admin, member, ws = team
    doc = new_doc(member, ws, "Old name")
    r = member.request("PATCH", f"/workspaces/{ws}/documents/{doc['id']}", json={"title": "New name"})
    assert r.status_code == 200
    assert r.json()["title"] == "New name"


def test_admin_can_rename_a_members_document(team):
    admin, member, ws = team
    doc = new_doc(member, ws, "Old name")
    r = admin.request("PATCH", f"/workspaces/{ws}/documents/{doc['id']}", json={"title": "By admin"})
    assert r.status_code == 200


def test_member_cannot_rename_someone_elses_document(team):
    admin, member, ws = team
    doc = new_doc(admin, ws, "Admin doc")
    r = member.request("PATCH", f"/workspaces/{ws}/documents/{doc['id']}", json={"title": "Hacked"})
    assert r.status_code == 403
    # and the title really did not change
    check = admin.request("GET", f"/workspaces/{ws}/documents/{doc['id']}")
    assert check.json()["title"] == "Admin doc"


def test_blank_title_is_rejected(team):
    admin, member, ws = team
    doc = new_doc(admin, ws)
    r = admin.request("PATCH", f"/workspaces/{ws}/documents/{doc['id']}", json={"title": "   "})
    assert r.status_code == 422


def test_rename_unknown_document_is_404(team):
    admin, member, ws = team
    r = admin.request(
        "PATCH",
        f"/workspaces/{ws}/documents/00000000-0000-0000-0000-000000000000",
        json={"title": "x"},
    )
    assert r.status_code == 404


def test_cannot_rename_through_another_workspace(team):
    admin, member, ws = team
    doc = new_doc(admin, ws)
    other = admin.request("POST", "/workspaces", json={"name": "Other"}).json()
    r = admin.request(
        "PATCH", f"/workspaces/{other['id']}/documents/{doc['id']}", json={"title": "Leak"}
    )
    assert r.status_code == 404


def test_rename_updates_the_updated_at_time(team):
    admin, member, ws = team
    doc = new_doc(admin, ws)
    r = admin.request("PATCH", f"/workspaces/{ws}/documents/{doc['id']}", json={"title": "Later"})
    assert r.json()["updated_at"] > doc["updated_at"]

# ---- List: paging, search, filter ----

def list_docs(user, ws, **params):
    r = user.request("GET", f"/workspaces/{ws}/documents", params=params)
    assert r.status_code == 200, r.text
    return r.json()


def test_list_has_items_and_no_cursor_when_everything_fits(team):
    admin, member, ws = team
    new_doc(admin, ws, "One")
    new_doc(admin, ws, "Two")
    page = list_docs(member, ws)
    assert len(page["items"]) == 2
    assert page["next_cursor"] is None


def test_list_is_newest_first(team):
    admin, member, ws = team
    new_doc(admin, ws, "First")
    new_doc(admin, ws, "Second")
    titles = [d["title"] for d in list_docs(member, ws)["items"]]
    assert titles == ["Second", "First"]


def test_paging_covers_every_document_exactly_once(team):
    admin, member, ws = team
    created = {new_doc(admin, ws, f"Doc {i}")["id"] for i in range(5)}
    seen, cursor = [], None
    for _ in range(10):  # safety limit so a bug cannot loop forever
        params = {"limit": 2}
        if cursor:
            params["cursor"] = cursor
        page = list_docs(member, ws, **params)
        seen += [d["id"] for d in page["items"]]
        cursor = page["next_cursor"]
        if cursor is None:
            break
    assert len(seen) == 5
    assert set(seen) == created


def test_new_document_between_pages_causes_no_duplicates(team):
    admin, member, ws = team
    for i in range(4):
        new_doc(admin, ws, f"Doc {i}")
    first = list_docs(member, ws, limit=2)
    new_doc(admin, ws, "Arrived later")
    second = list_docs(member, ws, limit=2, cursor=first["next_cursor"])
    first_ids = {d["id"] for d in first["items"]}
    second_ids = {d["id"] for d in second["items"]}
    assert first_ids.isdisjoint(second_ids)
    assert len(second["items"]) == 2


def test_limit_must_be_between_1_and_100(team):
    admin, member, ws = team
    for bad in (0, 101):
        r = member.request("GET", f"/workspaces/{ws}/documents", params={"limit": bad})
        assert r.status_code == 422


def test_garbage_cursor_gives_400(team):
    admin, member, ws = team
    r = member.request("GET", f"/workspaces/{ws}/documents", params={"cursor": "garbage"})
    assert r.status_code == 400


def test_status_filter(team):
    admin, member, ws = team
    new_doc(admin, ws)
    items = list_docs(member, ws, status="queued")["items"]
    assert all(d["status"] == "queued" for d in items)


def test_unknown_status_is_rejected(team):
    admin, member, ws = team
    r = member.request("GET", f"/workspaces/{ws}/documents", params={"status": "banana"})
    assert r.status_code == 422


def test_search_is_case_insensitive_and_partial(team):
    admin, member, ws = team
    new_doc(admin, ws, "Quarterly Report")
    new_doc(admin, ws, "Budget")
    titles = [d["title"] for d in list_docs(member, ws, q="quarter")["items"]]
    assert titles == ["Quarterly Report"]


def test_search_treats_percent_as_a_plain_character(team):
    admin, member, ws = team
    new_doc(admin, ws, "100% done")
    new_doc(admin, ws, "Something else")
    titles = [d["title"] for d in list_docs(member, ws, q="%")["items"]]
    assert titles == ["100% done"]


def test_search_never_returns_other_workspaces(team):
    admin, member, ws = team
    new_doc(admin, ws, "Secret plan")
    other = admin.request("POST", "/workspaces", json={"name": "Other"}).json()
    assert list_docs(admin, other["id"], q="secret")["items"] == []