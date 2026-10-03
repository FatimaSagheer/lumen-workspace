from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from psycopg import errors

from ..config import settings
from ..db import get_conn
from ..deps import get_current_user
from ..schemas import LoginIn, MeOut, RefreshIn, SignupIn, TokenOut
from ..security import (
    create_access_token,
    hash_password,
    hash_token,
    new_refresh_token,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


async def issue_tokens(conn, user_id) -> TokenOut:
    refresh = new_refresh_token()
    expires = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_days)
    await conn.execute(
        "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (%s, %s, %s)",
        (user_id, hash_token(refresh), expires),
    )
    return TokenOut(access_token=create_access_token(user_id), refresh_token=refresh)


@router.post("/signup", response_model=TokenOut, status_code=201)
async def signup(body: SignupIn, conn=Depends(get_conn)):
    try:
        cur = await conn.execute(
            "INSERT INTO users (email, password_hash, name) VALUES (%s, %s, %s) RETURNING id",
            (body.email.lower(), hash_password(body.password), body.name),
        )
    except errors.UniqueViolation:
        await conn.rollback()
        raise HTTPException(status_code=409, detail="Email already registered")
    user = await cur.fetchone()

    cur = await conn.execute(
        "INSERT INTO workspaces (name, created_by) VALUES (%s, %s) RETURNING id",
        (f"{body.name or 'My'} workspace", user["id"]),
    )
    ws = await cur.fetchone()
    await conn.execute(
        "INSERT INTO memberships (workspace_id, user_id, role) VALUES (%s, %s, 'admin')",
        (ws["id"], user["id"]),
    )
    tokens = await issue_tokens(conn, user["id"])
    await conn.commit()
    return tokens


@router.post("/login", response_model=TokenOut)
async def login(body: LoginIn, conn=Depends(get_conn)):
    cur = await conn.execute(
        "SELECT id, password_hash FROM users WHERE email = %s", (body.email.lower(),)
    )
    user = await cur.fetchone()
    if not user or not verify_password(user["password_hash"], body.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    tokens = await issue_tokens(conn, user["id"])
    await conn.commit()
    return tokens


@router.post("/refresh", response_model=TokenOut)
async def refresh(body: RefreshIn, conn=Depends(get_conn)):
    cur = await conn.execute(
        """UPDATE refresh_tokens SET revoked = true
           WHERE token_hash = %s AND revoked = false AND expires_at > now()
           RETURNING user_id""",
        (hash_token(body.refresh_token),),
    )
    row = await cur.fetchone()
    if not row:
        await conn.rollback()
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    tokens = await issue_tokens(conn, row["user_id"])
    await conn.commit()
    return tokens


@router.post("/logout", status_code=204)
async def logout(body: RefreshIn, conn=Depends(get_conn)):
    await conn.execute(
        "UPDATE refresh_tokens SET revoked = true WHERE token_hash = %s",
        (hash_token(body.refresh_token),),
    )
    await conn.commit()


@router.get("/me", response_model=MeOut)
async def me(user=Depends(get_current_user), conn=Depends(get_conn)):
    cur = await conn.execute(
        """SELECT w.id, w.name, m.role::text AS role
           FROM memberships m JOIN workspaces w ON w.id = m.workspace_id
           WHERE m.user_id = %s ORDER BY w.created_at""",
        (user["id"],),
    )
    return {**user, "workspaces": await cur.fetchall()}
