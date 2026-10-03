# UUID is a Python type used for universally unique identifiers.
#
# UUIDs are commonly used for database IDs because they are extremely
# unlikely to collide and are harder to guess than simple integer IDs.
#
# Example UUID:
# "550e8400-e29b-41d4-a716-446655440000"
#
# We use UUID here because our PostgreSQL tables use:
# id uuid PRIMARY KEY
from uuid import UUID


# BaseModel is the main class provided by Pydantic.
#
# When we create a class that inherits from BaseModel, Pydantic
# automatically:
#
# 1. Validates incoming data
# 2. Converts compatible data types
# 3. Gives us structured Python objects
# 4. Generates API documentation automatically
# 5. Can convert the model back to JSON/dictionaries
#
# Example:
#
# Incoming JSON:
# {
#     "email": "fatima@example.com",
#     "password": "mypassword123"
# }
#
# FastAPI can convert this JSON into a SignupIn Python object.
from pydantic import BaseModel, EmailStr, Field


# ============================================================
# SIGNUP REQUEST
# ============================================================

# SignupIn describes the data that the frontend must send
# when a user wants to create a new account.
#
# "In" usually means "Input".
#
# So:
# SignupIn = input/request schema for signup.
#
# This is NOT the database table.
#
# The database may contain additional fields such as:
# - id
# - password_hash
# - created_at
#
# The frontend does not need to send those fields during signup.
class SignupIn(BaseModel):

    # --------------------------------------------------------
    # EMAIL
    # --------------------------------------------------------

    # "email" is the name of the field expected from the client.
    #
    # EmailStr is a Pydantic type that validates that the value
    # looks like a valid email address.
    #
    # Example accepted:
    # "fatima@gmail.com"
    #
    # Example rejected:
    # "fatima"
    # "hello"
    # "abc@"
    #
    # Because there is no "=" and no default value,
    # this field is REQUIRED.
    email: EmailStr


    # --------------------------------------------------------
    # PASSWORD
    # --------------------------------------------------------

    # The client must provide a password.
    #
    # "str" means the password must be a string.
    #
    # Field(...) allows us to add validation rules.
    #
    # min_length=8:
    # Password must contain at least 8 characters.
    #
    # max_length=128:
    # Password cannot contain more than 128 characters.
    #
    # Examples:
    #
    # "abc123"          -> rejected because it has fewer than 8
    # "password123"     -> accepted
    # "a" * 129         -> rejected because it is too long
    #
    # IMPORTANT:
    # This only validates the PASSWORD INPUT.
    # It does NOT hash the password.
    #
    # Hashing should happen later inside your authentication
    # service/router before storing the password in PostgreSQL.
    password: str = Field(min_length=8, max_length=128)


    # --------------------------------------------------------
    # NAME
    # --------------------------------------------------------

    # The user can optionally provide their name.
    #
    # "str | None" means:
    #
    #     str
    # OR
    #     None
    #
    # This is Python's modern union syntax.
    #
    # For example:
    #
    # name = "Fatima"
    #
    # OR:
    #
    # name = None
    #
    # Field(default=None, max_length=100)
    # means:
    #
    # - If the client doesn't send "name", use None.
    # - If the client sends a name, it must be <= 100 characters.
    #
    # Because it has a default value, this field is OPTIONAL.
    name: str | None = Field(default=None, max_length=100)


# ============================================================
# LOGIN REQUEST
# ============================================================

# LoginIn describes the data required when an existing user
# wants to log into Lumen.
#
# Again, "In" means this is INPUT coming INTO the API.
#
# Expected JSON:
#
# {
#     "email": "fatima@example.com",
#     "password": "mypassword123"
# }
class LoginIn(BaseModel):

    # Email must be a valid email address.
    #
    # This field is required because there is no default value.
    email: EmailStr


    # Password must be a string.
    #
    # Notice that we don't have min_length/max_length here.
    #
    # Why?
    #
    # During signup, we enforce password length.
    #
    # During login, we generally don't need to repeat that
    # validation. The user is simply providing the password
    # they already created.
    #
    # The authentication code will compare this password
    # against the stored password hash.
    password: str


# ============================================================
# REFRESH TOKEN REQUEST
# ============================================================

# RefreshIn describes the data sent when the frontend wants
# to exchange a refresh token for a new access token.
#
# Expected JSON:
#
# {
#     "refresh_token": "some-long-refresh-token"
# }
#
# Why do we need this?
#
# Access tokens are normally short-lived for security.
#
# When the access token expires, the frontend can use the
# refresh token to obtain a new access token without forcing
# the user to log in again.
class RefreshIn(BaseModel):

    # The refresh token is expected to be a string.
    #
    # It is required because there is no default value.
    refresh_token: str


# ============================================================
# TOKEN RESPONSE
# ============================================================

# TokenOut describes the data that FastAPI returns after
# successful authentication.
#
# "Out" usually means "Output".
#
# So:
#
# TokenOut = output/response schema.
#
# Example response:
#
# {
#     "access_token": "eyJ...",
#     "refresh_token": "abc123...",
#     "token_type": "bearer"
# }
class TokenOut(BaseModel):

    # Short-lived token used to authenticate API requests.
    #
    # The frontend may eventually send it like:
    #
    # Authorization: Bearer <access_token>
    #
    # Depending on your final authentication architecture,
    # you may instead store/use it through secure cookies.
    access_token: str


    # Long-lived token used to obtain a new access token
    # after the access token expires.
    refresh_token: str


    # Describes the authentication scheme.
    #
    # "bearer" means the token is presented as a Bearer token.
    #
    # Because we provide:
    #
    #     = "bearer"
    #
    # the caller does not have to explicitly provide this field
    # when creating a TokenOut object.
    #
    # Example:
    #
    # TokenOut(
    #     access_token="abc",
    #     refresh_token="xyz"
    # )
    #
    # Automatically results in:
    #
    # {
    #     "access_token": "abc",
    #     "refresh_token": "xyz",
    #     "token_type": "bearer"
    # }
    token_type: str = "bearer"


# ============================================================
# WORKSPACE RESPONSE
# ============================================================

# WorkspaceOut describes what information about a workspace
# we want to send back to the frontend.
#
# Remember that Lumen is MULTI-TENANT.
#
# A user can belong to one or more workspaces.
#
# Example:
#
# User
#   |
#   +---- Workspace A
#   |
#   +---- Workspace B
#
# WorkspaceOut represents one of those workspaces.
class WorkspaceOut(BaseModel):

    # Unique ID of the workspace.
    #
    # UUID tells Pydantic that this value must be a valid UUID.
    #
    # This corresponds to the database:
    #
    # workspaces.id uuid PRIMARY KEY
    id: UUID


    # Human-readable workspace name.
    #
    # Example:
    #
    # "Fatima's Workspace"
    # "Research Team"
    # "Company Knowledge Base"
    name: str


    # The user's role inside this workspace.
    #
    # According to your database schema, the role is:
    #
    #     admin
    #     member
    #
    # We currently use "str" here rather than an Enum.
    #
    # That means Pydantic accepts any string:
    #
    # "admin"
    # "member"
    # "something-else"
    #
    # If you want stricter validation later, we could change
    # this to use your member_role Enum.
    role: str


# ============================================================
# CURRENT USER RESPONSE
# ============================================================

# MeOut represents the information returned when the frontend
# asks:
#
# "Who am I?"
#
# This is commonly used for an endpoint such as:
#
# GET /auth/me
#
# After the user logs in, the frontend can call this endpoint
# to retrieve the currently authenticated user's information.
class MeOut(BaseModel):

    # Unique ID of the logged-in user.
    #
    # Corresponds to:
    #
    # users.id
    #
    # in your PostgreSQL database.
    id: UUID


    # Email address of the logged-in user.
    #
    # Although SignupIn uses EmailStr, this response uses
    # plain "str".
    #
    # That's okay because this value is coming from your
    # trusted database rather than directly from the user.
    email: str


    # User's name.
    #
    # "str | None" means the name can either be:
    #
    # "Fatima"
    #
    # OR:
    #
    # None
    #
    # Notice there is NO default value here.
    #
    # This is important:
    #
    #     name: str | None
    #
    # means the field can contain None.
    #
    # It does not necessarily mean the field is optional
    # when creating a MeOut object.
    #
    # For a response model, FastAPI normally receives this
    # value from your database/user object.
    name: str | None


    # A list containing all workspaces that this user belongs to.
    #
    # list[WorkspaceOut] means:
    #
    # "This must be a Python list, and every item inside
    #  that list must follow the WorkspaceOut schema."
    #
    # Example:
    #
    # workspaces = [
    #     WorkspaceOut(...),
    #     WorkspaceOut(...),
    # ]
    #
    # So the API response can look like:
    #
    # {
    #     "id": "user-uuid",
    #     "email": "fatima@example.com",
    #     "name": "Fatima",
    #     "workspaces": [
    #         {
    #             "id": "workspace-uuid-1",
    #             "name": "Research",
    #             "role": "admin"
    #         },
    #         {
    #             "id": "workspace-uuid-2",
    #             "name": "Personal",
    #             "role": "member"
    #         }
    #     ]
    # }
    workspaces: list[WorkspaceOut]