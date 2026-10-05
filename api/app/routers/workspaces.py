from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from ..db import get_conn
from ..deps import get_current_user, get_membership, require_admin
from ..schemas import (
    AcceptIn,
    InviteIn,
    InviteOut,
    MemberOut,
    RoleUpdate,
    WorkspaceCreate,
    WorkspaceOut,
)
from ..security import hash_token, new_refresh_token

router = APIRouter(tags=["workspaces"])

INVITE_DAYS = 7


async def admin_count(conn, workspace_id) -> int:
    cur = await conn.execute(
        "SELECT count(*) AS n FROM memberships WHERE workspace_id = %s AND role = 'admin'",
        (workspace_id,),
    )
    return (await cur.fetchone())["n"]


@router.post("/workspaces", response_model=WorkspaceOut, status_code=201)
async def create_workspace(
    body: WorkspaceCreate, user=Depends(get_current_user), conn=Depends(get_conn)
):
    cur = await conn.execute(
        "INSERT INTO workspaces (name, created_by) VALUES (%s, %s) RETURNING id, name",
        (body.name.strip(), user["id"]),
    )
    ws = await cur.fetchone()
    await conn.execute(
        "INSERT INTO memberships (workspace_id, user_id, role) VALUES (%s, %s, 'admin')",
        (ws["id"], user["id"]),
    )
    await conn.commit()
    return {**ws, "role": "admin"}


@router.get("/workspaces/{workspace_id}/members", response_model=list[MemberOut])
async def list_members(m=Depends(get_membership), conn=Depends(get_conn)):
    cur = await conn.execute(
        """SELECT u.id AS user_id, u.email, u.name, ms.role::text AS role
           FROM memberships ms JOIN users u ON u.id = ms.user_id
           WHERE ms.workspace_id = %s
           ORDER BY (ms.role = 'admin') DESC, u.email""",
        (m["workspace_id"],),
    )
    return await cur.fetchall()


@router.patch("/workspaces/{workspace_id}/members/{user_id}")
async def change_role(
    user_id: UUID, body: RoleUpdate, m=Depends(require_admin), conn=Depends(get_conn)
):
    cur = await conn.execute(
        "SELECT role::text AS role FROM memberships WHERE workspace_id = %s AND user_id = %s",
        (m["workspace_id"], user_id),
    )
    target = await cur.fetchone()
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")
    if (
        target["role"] == "admin"
        and body.role == "member"
        and await admin_count(conn, m["workspace_id"]) <= 1
    ):
        raise HTTPException(status_code=400, detail="A workspace needs at least one admin")
    await conn.execute(
        "UPDATE memberships SET role = %s WHERE workspace_id = %s AND user_id = %s",
        (body.role, m["workspace_id"], user_id),
    )
    await conn.commit()
    return {"user_id": user_id, "role": body.role}


@router.delete("/workspaces/{workspace_id}/members/{user_id}", status_code=204)
async def remove_member(
    user_id: UUID, m=Depends(get_membership), conn=Depends(get_conn)
):
    is_self = user_id == m["user"]["id"]
    if not is_self and m["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    cur = await conn.execute(
        "SELECT role::text AS role FROM memberships WHERE workspace_id = %s AND user_id = %s",
        (m["workspace_id"], user_id),
    )
    target = await cur.fetchone()
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")
    if target["role"] == "admin" and await admin_count(conn, m["workspace_id"]) <= 1:
        raise HTTPException(status_code=400, detail="The last admin cannot be removed")

    await conn.execute(
        "DELETE FROM memberships WHERE workspace_id = %s AND user_id = %s",
        (m["workspace_id"], user_id),
    )
    await conn.commit()


@router.post(
    "/workspaces/{workspace_id}/invites", response_model=InviteOut, status_code=201
)
async def create_invite(
    body: InviteIn, m=Depends(require_admin), conn=Depends(get_conn)
):
    email = body.email.lower()

    cur = await conn.execute(
        """SELECT 1 FROM memberships ms JOIN users u ON u.id = ms.user_id
           WHERE ms.workspace_id = %s AND u.email = %s""",
        (m["workspace_id"], email),
    )
    if await cur.fetchone():
        raise HTTPException(status_code=409, detail="Already a member of this workspace")

    token = new_refresh_token()
    expires = datetime.now(timezone.utc) + timedelta(days=INVITE_DAYS)
    # Re-inviting the same email replaces the old pending invite with a fresh link
    await conn.execute(
        """INSERT INTO invitations (workspace_id, email, role, token_hash, invited_by, expires_at)
           VALUES (%s, %s, %s, %s, %s, %s)
           ON CONFLICT (workspace_id, email) WHERE accepted_at IS NULL
           DO UPDATE SET role = EXCLUDED.role, token_hash = EXCLUDED.token_hash,
                         expires_at = EXCLUDED.expires_at, invited_by = EXCLUDED.invited_by""",
        (m["workspace_id"], email, body.role, hash_token(token), m["user"]["id"], expires),
    )
    await conn.commit()
    # No email sending yet, so the admin shares this link by hand
    return InviteOut(
        email=email, role=body.role, expires_at=expires.isoformat(), invite_token=token
    )


@router.get("/workspaces/{workspace_id}/invites", response_model=list[InviteOut])
async def list_invites(m=Depends(require_admin), conn=Depends(get_conn)):
    cur = await conn.execute(
        """SELECT email, role::text AS role, expires_at::text AS expires_at
           FROM invitations
           WHERE workspace_id = %s AND accepted_at IS NULL AND expires_at > now()
           ORDER BY created_at DESC""",
        (m["workspace_id"],),
    )
    return await cur.fetchall()


@router.post("/invites/accept", response_model=WorkspaceOut)
async def accept_invite(
    body: AcceptIn, user=Depends(get_current_user), conn=Depends(get_conn)
):
    cur = await conn.execute(
        """SELECT i.id, i.email, i.role::text AS role, w.id AS workspace_id, w.name
           FROM invitations i JOIN workspaces w ON w.id = i.workspace_id
           WHERE i.token_hash = %s AND i.accepted_at IS NULL AND i.expires_at > now()""",
        (hash_token(body.token),),
    )
    inv = await cur.fetchone()
    if not inv:
        raise HTTPException(status_code=404, detail="Invite is invalid or has expired")
    if inv["email"] != user["email"].lower():
        raise HTTPException(
            status_code=403, detail="This invite was sent to a different email address"
        )

    await conn.execute(
        """INSERT INTO memberships (workspace_id, user_id, role) VALUES (%s, %s, %s)
           ON CONFLICT (workspace_id, user_id) DO NOTHING""",
        (inv["workspace_id"], user["id"], inv["role"]),
    )
    await conn.execute(
        "UPDATE invitations SET accepted_at = now() WHERE id = %s", (inv["id"],)
    )
    await conn.commit()
    return {"id": inv["workspace_id"], "name": inv["name"], "role": inv["role"]}