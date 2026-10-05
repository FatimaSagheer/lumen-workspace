from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

Role = Literal["admin", "member"]


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


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class InviteIn(BaseModel):
    email: EmailStr
    role: Role = "member"


class RoleUpdate(BaseModel):
    role: Role


class MemberOut(BaseModel):
    user_id: UUID
    email: str
    name: str | None
    role: str


class InviteOut(BaseModel):
    email: str
    role: str
    expires_at: str
    invite_token: str | None = None


class AcceptIn(BaseModel):
    token: str
