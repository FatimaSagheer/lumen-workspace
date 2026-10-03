from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class SignupIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str | None = Field(default=None, max_length=100)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class RefreshIn(BaseModel):
    refresh_token: str


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class WorkspaceOut(BaseModel):
    id: UUID
    name: str
    role: str


class MeOut(BaseModel):
    id: UUID
    email: str
    name: str | None
    workspaces: list[WorkspaceOut]
