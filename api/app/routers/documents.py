import asyncio
import random
from uuid import UUID

from fastapi import APIRouter, Depends , HTTPException

from ..db import get_conn, pool
from ..deps import get_membership
from ..document_schemas import DocumentCreate, DocumentOut

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


@router.get("/workspaces/{workspace_id}/documents", response_model=list[DocumentOut])
async def list_documents(m=Depends(get_membership), conn=Depends(get_conn)):
    # Temporary: newest 50, no paging. Replace with keyset pagination.
    cur = await conn.execute(
        SELECT_DOC
        + " WHERE d.workspace_id = %s ORDER BY d.created_at DESC, d.id DESC LIMIT 50",
        (m["workspace_id"],),
    )
    return await cur.fetchall()

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
    # Step 1: find it (same two conditions as get_document)
    cur = await conn.execute(
        "SELECT id, uploaded_by FROM documents WHERE id= %s AND workspace_id= %s",
        (doc_id, m["workspace_id"]),
    )
    doc = await cur.fetchone()

    # Step 2: nothing found -> 404
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    # Step 3: who is allowed?
    is_admin = m["role"] == "admin"
    is_uploader = doc["uploaded_by"] == m["user"]["id"]
    if not (is_admin or is_uploader):
        raise HTTPException(status_code=403, detail="Only an admin or the uploader can delete this document")

    # Step 4: delete it and save
    await conn.execute(
        "DELETE FROM documents WHERE id = %s AND workspace_id = %s",
        (doc_id, m['workspace_id']),
    )
    await conn.commit()
# ---- Your turn: add these below, one at a time ----
# 1. GET    /workspaces/{workspace_id}/documents/{doc_id}   (get one)
# 2. DELETE /workspaces/{workspace_id}/documents/{doc_id}   (admin or uploader)
# 3. PATCH  /workspaces/{workspace_id}/documents/{doc_id}   (rename)
# 4. GET    /workspaces/{workspace_id}/documents/stats      (put ABOVE the {doc_id} routes)
# 5. Replace list_documents with keyset pagination, search and a status filter