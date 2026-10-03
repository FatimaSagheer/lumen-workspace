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
