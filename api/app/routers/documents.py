import asyncio
import random
from uuid import UUID
import base64
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException ,Query

from ..db import get_conn, pool
from ..deps import get_membership
from ..document_schemas import (
    DocStatus,
    DocumentCreate,
    DocumentOut,
    DocumentPage,
    DocumentStats,
    DocumentUpdate,
)

router = APIRouter(tags=["documents"])

# Python keeps only a weak reference to a running task, so we hold our own
# reference until it finishes. Otherwise it can be garbage collected mid-run.
_tasks: set[asyncio.Task] = set()

SELECT_DOC = """
SELECT d.id, d.workspace_id, d.title, d.source_type, d.source_url, d.mime_type,
       d.size_bytes, d.status::text AS status, d.error, d.chunk_count,
       d.uploaded_by, u.name AS uploaded_by_name,
       d.created_at, d.updated_at, d.processed_at
FROM documents d
LEFT JOIN users u ON u.id = d.uploaded_by
"""


# ---- Helpers ----


async def get_doc_or_404(conn, workspace_id, doc_id):
    """Find a document inside this workspace, or answer 404."""
    cur = await conn.execute(
        "SELECT id, uploaded_by FROM documents WHERE id = %s AND workspace_id = %s",
        (doc_id, workspace_id),
    )
    doc = await cur.fetchone()
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


def require_admin_or_uploader(m, doc, action):
    """Allow admins and the person who uploaded the document, refuse everyone else."""
    is_admin = m["role"] == "admin"
    is_uploader = doc["uploaded_by"] == m["user"]["id"]
    if not (is_admin or is_uploader):
        raise HTTPException(
            status_code=403,
            detail=f"Only an admin or the uploader can {action} this document",
        )

def encode_cursor(created_at: datetime, doc_id: UUID) -> str:
    """Pack the last row's position into one opaque string (the bookmark)."""
    raw = f"{created_at.isoformat()}|{doc_id}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def decode_cursor(cursor: str) -> tuple[datetime, UUID]:
    """Unpack a bookmark. Anything that is not a valid one gets a 400, never a crash."""
    try:
        raw = base64.urlsafe_b64decode(cursor.encode()).decode()
        created_at, doc_id = raw.split("|")
        return datetime.fromisoformat(created_at), UUID(doc_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid cursor")


async def advance_status(doc_id: UUID) -> None:
    """Simulated processing: queued -> processing -> ready or failed.

    Week 7's real worker replaces the sleeps with real work but keeps the
    same UPDATEs. The WHERE status = ... guards make it safe if the document
    was deleted or changed in the meantime.
    """
    await asyncio.sleep(2)
    async with pool.connection() as conn:
        await conn.execute(
            """UPDATE documents SET status = 'processing', updated_at = now()
               WHERE id = %s AND status = 'queued'""",
            (doc_id,),
        )

    await asyncio.sleep(4)
    async with pool.connection() as conn:
        if random.random() < 0.2:
            await conn.execute(
                """UPDATE documents
                   SET status = 'failed', error = %s,
                       processed_at = now(), updated_at = now()
                   WHERE id = %s AND status = 'processing'""",
                ("Could not extract text from this document", doc_id),
            )
        else:
            await conn.execute(
                """UPDATE documents
                   SET status = 'ready', error = NULL, chunk_count = %s,
                       processed_at = now(), updated_at = now()
                   WHERE id = %s AND status = 'processing'""",
                (random.randint(5, 40), doc_id),
            )


# ---- Endpoints ----


@router.post(
    "/workspaces/{workspace_id}/documents",
    response_model=DocumentOut,
    status_code=201,
)
async def create_document(
    body: DocumentCreate,
    m=Depends(get_membership),
    conn=Depends(get_conn),
):
    cur = await conn.execute(
        """INSERT INTO documents
             (workspace_id, title, source_type, source_url, mime_type,
              size_bytes, uploaded_by)
           VALUES (%s, %s, %s, %s, %s, %s, %s)
           RETURNING id""",
        (
            m["workspace_id"],
            body.title,
            body.source_type,
            str(body.source_url) if body.source_url else None,
            body.mime_type,
            body.size_bytes,
            m["user"]["id"],
        ),
    )
    doc_id = (await cur.fetchone())["id"]

    cur = await conn.execute(
        SELECT_DOC + " WHERE d.id = %s AND d.workspace_id = %s",
        (doc_id, m["workspace_id"]),
    )
    doc = await cur.fetchone()
    await conn.commit()

    # Start the simulated processing on its own, so this request's database
    # connection is released as soon as the response is sent.
    task = asyncio.create_task(advance_status(doc_id))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
    return doc


@router.get("/workspaces/{workspace_id}/documents", response_model=DocumentPage)
async def list_documents(
    m=Depends(get_membership),
    conn=Depends(get_conn),
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    status: DocStatus | None = None,
    q: str | None = Query(None, max_length=100),
):
    # Build the WHERE part piece by piece. Every user-supplied VALUE goes into
    # params and is filled in through a %s blank. Never paste it into the text.
    conditions = ["d.workspace_id = %s"]
    params = [m["workspace_id"]]

    if status:
        conditions.append("d.status = %s")
        params.append(status)

    if q:
        # Make %, _ and \ ordinary characters instead of wildcards
        escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        conditions.append("d.title ILIKE %s")
        params.append(f"%{escaped}%")

    if cursor:
        created_at, last_id = decode_cursor(cursor)
        conditions.append("(d.created_at, d.id) < (%s, %s)")
        params.extend([created_at, last_id])

    sql = (
        SELECT_DOC
        + " WHERE " + " AND ".join(conditions)
        + " ORDER BY d.created_at DESC, d.id DESC LIMIT %s"
    )
    params.append(limit + 1)  # ask for ONE extra row to learn if another page exists

    cur = await conn.execute(sql, params)
    rows = await cur.fetchall()

    next_cursor = None
    if len(rows) > limit:
        rows = rows[:limit]
        last = rows[-1]
        next_cursor = encode_cursor(last["created_at"], last["id"])

    return {"items": rows, "next_cursor": next_cursor}

    
# IMPORTANT: this route must stay ABOVE get_document. FastAPI checks routes top
# to bottom, and {doc_id} would otherwise swallow the word "stats".
@router.get("/workspaces/{workspace_id}/documents/stats", response_model=DocumentStats)
async def document_stats(m=Depends(get_membership), conn=Depends(get_conn)):
    cur = await conn.execute(
        """SELECT count(*) AS total,
                  count(*) FILTER (WHERE status = 'queued') AS queued,
                  count(*) FILTER (WHERE status = 'processing') AS processing,
                  count(*) FILTER (WHERE status = 'ready') AS ready,
                  count(*) FILTER (WHERE status = 'failed') AS failed
           FROM documents
           WHERE workspace_id = %s""",
        (m["workspace_id"],),
    )
    return await cur.fetchone()


@router.get("/workspaces/{workspace_id}/documents/{doc_id}", response_model=DocumentOut)
async def get_document(
    doc_id: UUID,
    m=Depends(get_membership),
    conn=Depends(get_conn),
):
    cur = await conn.execute(
        SELECT_DOC + " WHERE d.id = %s AND d.workspace_id = %s",
        (doc_id, m["workspace_id"]),
    )
    doc = await cur.fetchone()
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.delete("/workspaces/{workspace_id}/documents/{doc_id}", status_code=204)
async def delete_document(
    doc_id: UUID,
    m=Depends(get_membership),
    conn=Depends(get_conn),
):
    doc = await get_doc_or_404(conn, m["workspace_id"], doc_id)
    require_admin_or_uploader(m, doc, "delete")

    await conn.execute(
        "DELETE FROM documents WHERE id = %s AND workspace_id = %s",
        (doc_id, m["workspace_id"]),
    )
    await conn.commit()


@router.patch("/workspaces/{workspace_id}/documents/{doc_id}", response_model=DocumentOut)
async def rename_document(
    doc_id: UUID,
    body: DocumentUpdate,
    m=Depends(get_membership),
    conn=Depends(get_conn),
):
    doc = await get_doc_or_404(conn, m["workspace_id"], doc_id)
    require_admin_or_uploader(m, doc, "rename")

    await conn.execute(
        "UPDATE documents SET title = %s, updated_at = now() WHERE id = %s AND workspace_id = %s",
        (body.title, doc_id, m["workspace_id"]),
    )
    await conn.commit()

    cur = await conn.execute(
        SELECT_DOC + " WHERE d.id = %s AND d.workspace_id = %s",
        (doc_id, m["workspace_id"]),
    )
    return await cur.fetchone()