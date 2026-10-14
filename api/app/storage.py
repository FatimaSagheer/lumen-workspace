"""Everything that talks to object storage (Cloudflare R2) lives in this one file.

The rest of the app never imports boto3. If we ever change provider, only this
file changes.
"""

import re
from functools import lru_cache

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from .config import settings

# What we accept: content type -> the file ending we expect
ALLOWED_TYPES = {
    "application/pdf": ".pdf",
    "text/plain": ".txt",
    "text/markdown": ".md",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}
MAX_BYTES = 20 * 1024 * 1024  # 20 MB
UPLOAD_URL_SECONDS = 300  # an upload link works for 5 minutes
DOWNLOAD_URL_SECONDS = 60  # a download link works for 1 minute


@lru_cache
def _client():
    """Create the storage client once and reuse it."""
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )


def safe_filename(name: str) -> str:
    """Make a user-supplied file name safe to use inside a storage key."""
    name = name.replace("\\", "/").split("/")[-1]  # drop any folders
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name)  # odd characters -> underscore
    name = name.strip("._")  # no hidden files, no leading dots
    return name[:100] or "file"


def make_key(workspace_id, doc_id, filename: str) -> str:
    """The SERVER decides where a file lives. The user never chooses the key."""
    return f"workspaces/{workspace_id}/documents/{doc_id}/{safe_filename(filename)}"


def presign_upload(key: str, content_type: str) -> str:
    """A short-lived link that lets the browser upload ONE object to this key.

    Signing happens on our machine (no network call), so it is fast and safe to
    call directly.
    """
    return _client().generate_presigned_url(
        "put_object",
        Params={"Bucket": settings.s3_bucket, "Key": key, "ContentType": content_type},
        ExpiresIn=UPLOAD_URL_SECONDS,
    )


def presign_download(key: str, filename: str) -> str:
    """A short-lived link to download one object."""
    return _client().generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.s3_bucket,
            "Key": key,
            "ResponseContentDisposition": f'attachment; filename="{safe_filename(filename)}"',
        },
        ExpiresIn=DOWNLOAD_URL_SECONDS,
    )


# The two functions below make a REAL network call and BLOCK until it finishes.
# Inside an async endpoint, call them like:  await asyncio.to_thread(head_object, key)


def head_object(key: str) -> dict | None:
    """Ask storage about an object. Returns its size and type, or None if missing."""
    try:
        r = _client().head_object(Bucket=settings.s3_bucket, Key=key)
    except ClientError as e:
        if e.response["Error"]["Code"] in ("404", "NoSuchKey", "NotFound"):
            return None
        raise
    return {"size": r["ContentLength"], "content_type": r.get("ContentType")}


def delete_object(key: str) -> None:
    """Delete an object. Deleting something that is already gone is fine."""
    _client().delete_object(Bucket=settings.s3_bucket, Key=key)   x