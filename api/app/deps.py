# ============================================================
# JWT / AUTHENTICATION DEPENDENCY
# ============================================================
#
# This file contains reusable FastAPI dependencies related to
# authentication.
#
# The most important function here is:
#
#     get_current_user()
#
# It answers the question:
#
#     "Who is the currently logged-in user?"
#
# Other protected endpoints can then use:
#
#     current_user = Depends(get_current_user)
#
# instead of repeating JWT validation and database lookup
# code in every endpoint.


# PyJWT is the Python library used to work with JSON Web Tokens.
#
# We use it here mainly for its exception classes.
#
# decode_access_token() in security.py is responsible for
# actually decoding/validating the token.
import jwt


# Depends:
# FastAPI's dependency injection system.
#
# HTTPException:
# Used when we want to stop the request and return an HTTP
# error response such as 401 Unauthorized.
from fastapi import Depends, HTTPException


# HTTPAuthorizationCredentials:
# Represents the credentials extracted from an HTTP
# Authorization header.
#
# HTTPBearer:
# Tells FastAPI that our API expects a Bearer token.
#
# Example HTTP request:
#
# Authorization: Bearer eyJhbGciOiJIUzI1Ni...
#
# HTTPBearer extracts the token part:
#
# eyJhbGciOiJIUzI1Ni...
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)


# get_conn is our database dependency.
#
# It gives this function access to a PostgreSQL connection.
#
# We will use that connection to find the user in the
# "users" table after validating the JWT.
from .db import get_conn


# decode_access_token() is our own authentication helper.
#
# It should:
#
# 1. Receive the JWT
# 2. Verify its signature
# 3. Verify expiration
# 4. Decode the payload
# 5. Return the payload
#
# We are NOT implementing those details here.
# They belong in security.py.
from .security import decode_access_token


# ============================================================
# CREATE A BEARER AUTHENTICATION SCHEME
# ============================================================

# HTTPBearer() tells FastAPI:
#
# "For protected endpoints, expect an Authorization header
#  containing a Bearer token."
#
# Example:
#
# Authorization: Bearer abc123
#
# FastAPI will parse this header for us.
#
# Later, when we write:
#
#     creds: HTTPAuthorizationCredentials = Depends(bearer)
#
# FastAPI will automatically call "bearer" and give us the
# extracted credentials.
bearer = HTTPBearer()


# ============================================================
# GET CURRENT USER
# ============================================================

# This is a FastAPI dependency.
#
# Its job is:
#
#     Request
#       ↓
#     Extract JWT
#       ↓
#     Validate JWT
#       ↓
#     Get user ID from JWT
#       ↓
#     Find user in PostgreSQL
#       ↓
#     Return user
#
# Any protected API endpoint can reuse this function.
async def get_current_user(

    # --------------------------------------------------------
    # AUTHORIZATION HEADER
    # --------------------------------------------------------
    #
    # FastAPI's Depends(bearer) tells FastAPI:
    #
    # "Use the HTTPBearer security scheme to get the
    #  Authorization credentials from this request."
    #
    # For example, the request contains:
    #
    # Authorization: Bearer eyJhbGciOiJIUzI1Ni...
    #
    # FastAPI gives us an object like:
    #
    # HTTPAuthorizationCredentials(
    #     scheme="Bearer",
    #     credentials="eyJhbGciOiJIUzI1Ni..."
    # )
    #
    # Therefore:
    #
    # creds.credentials
    #
    # contains the actual JWT string.
    creds: HTTPAuthorizationCredentials = Depends(bearer),


    # --------------------------------------------------------
    # DATABASE CONNECTION
    # --------------------------------------------------------
    #
    # Depends(get_conn) tells FastAPI:
    #
    # "Give this function a database connection."
    #
    # We need the database connection because after validating
    # the token, we need to look up the user in PostgreSQL.
    #
    # Example:
    #
    # JWT says:
    #
    # sub = "550e8400-e29b-41d4-a716-446655440000"
    #
    # Then we query:
    #
    # SELECT id, email, name
    # FROM users
    # WHERE id = that UUID
    #
    conn=Depends(get_conn),

):

    # ========================================================
    # STEP 1 — DECODE / VALIDATE JWT
    # ========================================================

    try:

        # creds.credentials contains the actual JWT.
        #
        # Example:
        #
        # creds.credentials
        #     ↓
        # "eyJhbGciOiJIUzI1NiIs..."
        #
        # We pass that token to our security helper.
        #
        # decode_access_token() should verify things such as:
        #
        # - signature
        # - expiration
        # - token structure
        #
        # It should return the decoded payload.
        #
        # Example payload:
        #
        # {
        #     "sub": "550e8400-e29b-41d4-a716-446655440000",
        #     "exp": 1790000000
        # }
        payload = decode_access_token(creds.credentials)


    # --------------------------------------------------------
    # HANDLE INVALID JWT
    # --------------------------------------------------------

    # PyJWT can raise different exceptions when a token is
    # invalid, expired, malformed, etc.
    #
    # jwt.PyJWTError is the base exception class for PyJWT
    # errors.
    #
    # If anything related to JWT validation fails, we return:
    #
    # HTTP 401 Unauthorized
    except jwt.PyJWTError:

        # HTTPException immediately stops the request.
        #
        # status_code=401:
        # The client is not authenticated.
        #
        # detail:
        # Human-readable error message.
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
        )


    # ========================================================
    # STEP 2 — GET USER ID FROM JWT
    # ========================================================

    # The JWT payload should contain a "sub" claim.
    #
    # "sub" traditionally means "subject".
    #
    # In our application, the subject is the user's ID.
    #
    # Example:
    #
    # payload = {
    #     "sub": "550e8400-e29b-41d4-a716-446655440000",
    #     "exp": 1790000000
    # }
    #
    # Therefore:
    #
    # payload["sub"]
    #
    # gives us the user ID.
    #
    # We use that ID to find the actual user in PostgreSQL.


    # ========================================================
    # STEP 3 — FIND USER IN DATABASE
    # ========================================================

    # Execute a SQL query against PostgreSQL.
    #
    # We only retrieve:
    #
    # - id
    # - email
    # - name
    #
    # We intentionally DON'T retrieve password_hash.
    #
    # WHERE id = %s
    #
    # means:
    #
    # "Find the user whose ID matches the JWT subject."
    #
    # (payload["sub"],)
    #
    # is the parameter passed to the SQL query.
    #
    # IMPORTANT:
    #
    # The parameter is passed separately rather than building
    # the SQL string manually.
    #
    # This helps prevent SQL injection.
    cur = await conn.execute(

        "SELECT id, email, name FROM users WHERE id = %s",

        (payload["sub"],)

    )


    # ========================================================
    # STEP 4 — GET THE DATABASE RESULT
    # ========================================================

    # fetchone() retrieves one row from the query result.
    #
    # If the user exists:
    #
    # user might look conceptually like:
    #
    # (
    #     UUID("550e8400-e29b-41d4-a716-446655440000"),
    #     "fatima@example.com",
    #     "Fatima"
    # )
    #
    # If no user exists:
    #
    # user = None
    user = await cur.fetchone()


    # ========================================================
    # STEP 5 — MAKE SURE USER STILL EXISTS
    # ========================================================

    # A JWT can still be structurally valid even if the user
    # has subsequently been deleted from the database.
    #
    # Therefore we don't trust the JWT alone.
    #
    # We also verify that the user actually exists.
    if not user:

        # If there is no matching database user, the request
        # is unauthorized.
        raise HTTPException(
            status_code=401,
            detail="User not found",
        )


    # ========================================================
    # STEP 6 — RETURN CURRENT USER
    # ========================================================

    # Return the database row.
    #
    # The endpoint that uses this dependency will receive this
    # value as "current_user".
    #
    # Example:
    #
    # current_user = (
    #     UUID(...),
    #     "fatima@example.com",
    #     "Fatima"
    # )
    return user