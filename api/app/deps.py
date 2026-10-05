from uuid import UUID

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .db import get_conn
from .security import decode_access_token

bearer = HTTPBearer()


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    conn=Depends(get_conn),
):
    try:
        payload = decode_access_token(creds.credentials)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    cur = await conn.execute(
        "SELECT id, email, name FROM users WHERE id = %s", (payload["sub"],)
    )
    user = await cur.fetchone()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def get_membership(
    workspace_id: UUID,
    user=Depends(get_current_user),
    conn=Depends(get_conn),
):
    cur = await conn.execute(
        "SELECT role::text AS role FROM memberships WHERE workspace_id = %s AND user_id = %s",
        (workspace_id, user["id"]),
    )
    row = await cur.fetchone()
    if not row:
        # 404, not 403: don't reveal that a workspace exists to people outside it
        raise HTTPException(status_code=404, detail="Workspace not found")
    return {"user": user, "role": row["role"], "workspace_id": workspace_id}


async def require_admin(m=Depends(get_membership)):
    if m["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return m
