# ============================================================
# SECURITY UTILITIES
# ============================================================
#
# This file contains security-related helper functions for
# the Lumen authentication system.
#
# It handles:
#
# 1. Password hashing
# 2. Password verification
# 3. Access-token creation
# 4. Access-token decoding/verification
# 5. Refresh-token generation
# 6. Refresh-token hashing
#
#
# Authentication flow:
#
# SIGNUP
# ──────────────────────────────────────────────
#
# User password
#      ↓
# hash_password()
#      ↓
# Argon2 hash
#      ↓
# PostgreSQL users.password_hash
#
#
# LOGIN
# ──────────────────────────────────────────────
#
# User password
#      ↓
# verify_password()
#      ↓
# Compare with stored Argon2 hash
#      ↓
# Create access token
#      ↓
# Create refresh token
#
#
# PROTECTED REQUEST
# ──────────────────────────────────────────────
#
# Access token
#      ↓
# decode_access_token()
#      ↓
# Validate JWT signature + expiration
#      ↓
# Get user ID from "sub"
#      ↓
# Find user in PostgreSQL


# ============================================================
# hashlib
# ============================================================
#
# hashlib is part of Python's standard library.
#
# We use SHA-256 later to hash refresh tokens before storing
# them in the database.
#
# IMPORTANT:
#
# We do NOT use SHA-256 for passwords.
#
# Passwords use Argon2 because password hashing requires a
# deliberately slow, memory-hard algorithm.
import hashlib


# ============================================================
# secrets
# ============================================================
#
# Python's secrets module is designed for generating
# cryptographically secure random values.
#
# We use it to generate refresh tokens.
#
# We should NOT use:
#
#     random
#
# for security-sensitive tokens.
#
# secrets is specifically designed for security-sensitive
# random values.
import secrets


# ============================================================
# DATETIME
# ============================================================
#
# datetime:
#     Represents a date and time.
#
# timedelta:
#     Represents a duration such as 15 minutes or 14 days.
#
# timezone:
#     Used here to create timezone-aware UTC timestamps.
#
# We need these for JWT:
#
# "iat" = issued-at time
# "exp" = expiration time
from datetime import datetime, timedelta, timezone


# ============================================================
# JWT
# ============================================================
#
# PyJWT is the library we use to create and decode JSON Web
# Tokens.
#
# We use:
#
#     jwt.encode()
#
# to create an access token.
#
# And:
#
#     jwt.decode()
#
# to verify and decode an access token.
import jwt


# ============================================================
# ARGON2 PASSWORD HASHER
# ============================================================
#
# PasswordHasher is provided by argon2-cffi.
#
# Argon2 is a password-hashing algorithm designed specifically
# for securely storing passwords.
#
# We should NEVER store passwords like:
#
#     password123
#
# directly in PostgreSQL.
#
# Instead:
#
# password123
#      ↓
# Argon2
#      ↓
# $argon2id$...
#
# The resulting hash is stored in:
#
# users.password_hash
from argon2 import PasswordHasher


# VerifyMismatchError is raised by Argon2 when the supplied
# password does not match the stored password hash.
#
# We catch this exception during login and return False
# instead of allowing the exception to crash the request.
from argon2.exceptions import VerifyMismatchError


# Import our application settings.
#
# settings comes from config.py.
#
# We need:
#
#     settings.jwt_secret
#
#     settings.access_token_minutes
#
#     settings.refresh_token_days
#
# Although refresh_token_days is defined in config.py,
# this particular file does not currently use it directly.
from .config import settings


# ============================================================
# CREATE ARGON2 PASSWORD HASHER
# ============================================================

# Create one PasswordHasher instance.
#
# The underscore at the beginning:
#
#     _ph
#
# is a Python naming convention meaning:
#
# "This is intended to be an internal/private module variable."
#
# We can then use:
#
#     _ph.hash(...)
#
# and:
#
#     _ph.verify(...)
#
# throughout this file.
_ph = PasswordHasher()


# ============================================================
# PASSWORD HASHING
# ============================================================

def hash_password(password: str) -> str:

    # password: str
    #
    # Means the function expects a string.
    #
    # -> str
    #
    # Means the function returns a string.
    #
    #
    # _ph.hash(password)
    #
    # sends the plaintext password to Argon2.
    #
    # Argon2 automatically creates a random salt and produces
    # a secure password hash.
    #
    # Example:
    #
    # Input:
    #     "password123"
    #
    # Output:
    #     "$argon2id$v=19$m=65536,t=3,p=4$..."
    #
    # The actual hash will be different because Argon2 uses
    # a random salt.
    #
    # IMPORTANT:
    #
    # We return the hash.
    #
    # We NEVER return/store the plaintext password.
    return _ph.hash(password)


# ============================================================
# PASSWORD VERIFICATION
# ============================================================

def verify_password(
    password_hash: str | None,
    password: str
) -> bool:

    # password_hash:
    #
    # The hash retrieved from PostgreSQL.
    #
    # It is "str | None" because the database schema allows:
    #
    #     password_hash text
    #
    # without NOT NULL.
    #
    # So the value might be:
    #
    #     "$argon2id$..."
    #
    # OR:
    #
    #     None
    #
    #
    # password:
    #
    # The plaintext password submitted by the user during
    # login.
    #
    #
    # -> bool
    #
    # means this function returns:
    #
    # True
    #     password is correct
    #
    # False
    #     password is incorrect


    # --------------------------------------------------------
    # CHECK WHETHER A PASSWORD HASH EXISTS
    # --------------------------------------------------------

    # If password_hash is None or empty, we cannot verify
    # the password.
    #
    # "not password_hash" catches:
    #
    # None
    # ""
    #
    # etc.
    if not password_hash:

        # Authentication should fail.
        #
        # We return False rather than raising an exception.
        return False


    # --------------------------------------------------------
    # TRY ARGON2 VERIFICATION
    # --------------------------------------------------------

    try:

        # Argon2 compares:
        #
        #     stored password hash
        #
        # against:
        #
        #     password supplied by the user
        #
        # If they match:
        #
        #     True
        #
        # If they don't:
        #
        #     VerifyMismatchError
        #
        # is raised.
        return _ph.verify(password_hash, password)


    # --------------------------------------------------------
    # PASSWORD DOES NOT MATCH
    # --------------------------------------------------------

    except VerifyMismatchError:

        # A wrong password is an expected authentication
        # failure, not a server crash.
        #
        # Therefore we simply return False.
        return False


# ============================================================
# CREATE ACCESS TOKEN
# ============================================================

def create_access_token(user_id) -> str:

    # This function creates a JWT access token for a user.
    #
    # Example:
    #
    # User logs in
    #     ↓
    # create_access_token(user_id)
    #     ↓
    # JWT
    #     ↓
    # Send JWT to frontend
    #
    # The access token is intended to be short-lived.


    # --------------------------------------------------------
    # CURRENT TIME
    # --------------------------------------------------------

    # datetime.now(timezone.utc) gets the current time in UTC.
    #
    # UTC is important because servers and users can be in
    # different time zones.
    #
    # Example:
    #
    # Pakistan: UTC+5
    # Korea:    UTC+9
    # USA:      multiple time zones
    #
    # Using UTC gives the backend one consistent reference.
    now = datetime.now(timezone.utc)


    # --------------------------------------------------------
    # JWT PAYLOAD
    # --------------------------------------------------------

    # A JWT contains a payload.
    #
    # Here we're storing three claims:
    #
    #     sub
    #     iat
    #     exp
    #
    payload = {

        # ----------------------------------------------------
        # "sub" = SUBJECT
        # ----------------------------------------------------
        #
        # The subject identifies who the token belongs to.
        #
        # In Lumen:
        #
        #     sub = user ID
        #
        # user_id might be a UUID object.
        #
        # We convert it to str because JWT payload values
        # should use JSON-compatible types.
        #
        # Example:
        #
        # UUID object
        #      ↓
        # str(user_id)
        #      ↓
        # "550e8400-e29b-41d4-a716-446655440000"
        #
        # Later, get_current_user() does:
        #
        #     payload["sub"]
        #
        # to retrieve this user ID.
        "sub": str(user_id),


        # ----------------------------------------------------
        # "iat" = ISSUED AT
        # ----------------------------------------------------
        #
        # Records when the token was created.
        #
        # Example:
        #
        # "iat": 2026-10-03 14:00 UTC
        #
        # This can be useful for token auditing and other
        # authentication logic.
        "iat": now,


        # ----------------------------------------------------
        # "exp" = EXPIRATION
        # ----------------------------------------------------
        #
        # Determines when the token becomes invalid.
        #
        # We take the current UTC time:
        #
        #     now
        #
        # and add:
        #
        #     settings.access_token_minutes
        #
        # minutes.
        #
        # If settings says:
        #
        #     access_token_minutes = 15
        #
        # then:
        #
        #     exp = now + 15 minutes
        #
        "exp": now + timedelta(
            minutes=settings.access_token_minutes
        ),
    }


    # --------------------------------------------------------
    # ENCODE JWT
    # --------------------------------------------------------

    # jwt.encode() converts our payload into a signed JWT.
    #
    # Arguments:
    #
    # payload:
    #     The information stored inside the token.
    #
    # settings.jwt_secret:
    #     Secret key used to sign the token.
    #
    # algorithm="HS256":
    #     The signing algorithm.
    #
    # HS256 means:
    #
    # HMAC + SHA-256
    #
    # The same secret is used to create and verify the token.
    #
    # The resulting value looks something like:
    #
    # eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
    #
    # That string is the JWT.
    return jwt.encode(
        payload,
        settings.jwt_secret,
        algorithm="HS256",
    )


# ============================================================
# DECODE / VERIFY ACCESS TOKEN
# ============================================================

def decode_access_token(token: str) -> dict:

    # This function takes a JWT and verifies it.
    #
    # It is used later by:
    #
    #     get_current_user()
    #
    # The function:
    #
    # 1. Receives the JWT
    # 2. Uses the secret to verify its signature
    # 3. Checks expiration
    # 4. Decodes the payload
    # 5. Returns the payload
    #
    # If the token is invalid or expired, PyJWT raises an
    # exception.
    #
    # get_current_user() catches that exception and returns
    # HTTP 401.


    # jwt.decode() verifies and decodes the token.
    #
    # token:
    #     JWT received from the client.
    #
    # settings.jwt_secret:
    #     Secret used to verify the signature.
    #
    # algorithms=["HS256"]:
    #     Only accept HS256 tokens.
    #
    # Restricting the allowed algorithm is important because
    # we don't want to accept an unexpected algorithm.
    #
    # The returned value is the decoded payload dictionary.
    return jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=["HS256"],
    )


# ============================================================
# CREATE REFRESH TOKEN
# ============================================================

def new_refresh_token() -> str:

    # secrets.token_urlsafe(48) generates a cryptographically
    # secure random token.
    #
    # "48" represents 48 random bytes of entropy.
    #
    # token_urlsafe() encodes the random bytes into a string
    # that is safe to transport in URLs/HTTP contexts.
    #
    # Example output:
    #
    # "kH7m...long-random-value..."
    #
    # Every call should produce a different unpredictable
    # value.
    #
    # This is NOT a JWT.
    #
    # Access token:
    #     JWT
    #
    # Refresh token:
    #     Random opaque string
    return secrets.token_urlsafe(48)


# ============================================================
# HASH REFRESH TOKEN
# ============================================================

def hash_token(token: str) -> str:

    # We don't want to store the raw refresh token in the
    # database.
    #
    # Instead:
    #
    # Raw refresh token
    #       ↓
    # SHA-256
    #       ↓
    # Hash
    #       ↓
    # PostgreSQL
    #
    # If the database is compromised, attackers don't directly
    # get the original refresh tokens.


    # token.encode()
    #
    # Converts the Python string into bytes.
    #
    # SHA-256 works with bytes.
    #
    # Example:
    #
    # "abc123"
    #      ↓
    # b"abc123"
    #
    # hashlib.sha256(...)
    #
    # calculates the SHA-256 hash.
    #
    # .hexdigest()
    #
    # converts the resulting binary hash into a readable
    # hexadecimal string.
    #
    # Example:
    #
    # "abc123"
    #      ↓
    # SHA-256
    #      ↓
    # "6ca13d52ca70c883e0f0bb10d..."
    return hashlib.sha256(
        token.encode()
    ).hexdigest()