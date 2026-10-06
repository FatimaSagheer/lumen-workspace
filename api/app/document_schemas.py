from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import AnyHttpUrl, BaseModel, Field, field_validator, model_validator

DocStatus = Literal["queued", "processing", "ready", "failed"]
SourceType = Literal["upload", "url"]


class DocumentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    source_type: SourceType
    source_url: AnyHttpUrl | None = None
    mime_type: str | None = Field(default=None, max_length=100)
    size_bytes: int | None = Field(default=None, ge=0)

    @field_validator("title")
    @classmethod
    def clean_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Title cannot be blank")
        return v

    @model_validator(mode="after")
    def url_rules(self):
        if self.source_type == "url" and self.source_url is None:
            raise ValueError("source_url is required when source_type is url")
        if self.source_type == "upload" and self.source_url is not None:
            raise ValueError("source_url must be empty when source_type is upload")
        return self


class DocumentUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=200)

    @field_validator("title")
    @classmethod
    def clean_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Title cannot be blank")
        return v


class DocumentOut(BaseModel):
    id: UUID
    workspace_id: UUID
    title: str
    source_type: SourceType
    source_url: str | None
    mime_type: str | None
    size_bytes: int | None
    status: DocStatus
    error: str | None
    chunk_count: int
    uploaded_by: UUID | None
    uploaded_by_name: str | None = None   # filled from a JOIN on users
    created_at: datetime
    updated_at: datetime
    processed_at: datetime | None


class DocumentPage(BaseModel):
    items: list[DocumentOut]
    next_cursor: str | None = None        # None means this is the last page


class DocumentStats(BaseModel):
    total: int
    queued: int
    processing: int
    ready: int
    failed: int
