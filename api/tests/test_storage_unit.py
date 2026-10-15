from app.storage import ALLOWED_TYPES, MAX_BYTES, make_key, safe_filename


def test_safe_filename_drops_folders():
    assert safe_filename("../../etc/passwd") == "passwd"
    assert safe_filename("C:\\Users\\me\\report.pdf") == "report.pdf"


def test_safe_filename_replaces_odd_characters():
    assert safe_filename("my report (final).pdf") == "my_report_final_.pdf"


def test_safe_filename_has_no_hidden_files_and_never_comes_back_empty():
    assert safe_filename(".bashrc") == "bashrc"
    assert safe_filename("...") == "file"
    assert safe_filename("") == "file"


def test_safe_filename_is_not_too_long():
    assert len(safe_filename("a" * 300 + ".pdf")) <= 100


def test_key_is_built_by_the_server_and_stays_inside_the_workspace():
    key = make_key("ws1", "doc1", "../../other/evil.pdf")
    assert key == "workspaces/ws1/documents/doc1/evil.pdf"
    assert ".." not in key


def test_limits_are_sensible():
    assert MAX_BYTES == 20 * 1024 * 1024
    assert "application/pdf" in ALLOWED_TYPES
    assert "application/x-msdownload" not in ALLOWED_TYPES