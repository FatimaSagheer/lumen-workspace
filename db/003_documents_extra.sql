CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS source_url   text,
  ADD COLUMN IF NOT EXISTS mime_type    text,
  ADD COLUMN IF NOT EXISTS size_bytes   bigint,
  ADD COLUMN IF NOT EXISTS chunk_count  int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at   timestamptz NOT NULL DEFAULT now();

-- Rules the database itself enforces (the API validates too, this is the safety net)
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_source_type_chk;
ALTER TABLE documents ADD CONSTRAINT documents_source_type_chk
  CHECK (source_type IN ('upload', 'url'));

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_title_chk;
ALTER TABLE documents ADD CONSTRAINT documents_title_chk
  CHECK (char_length(title) BETWEEN 1 AND 200);

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_url_chk;
ALTER TABLE documents ADD CONSTRAINT documents_url_chk
  CHECK ((source_type = 'url') = (source_url IS NOT NULL));

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_error_chk;
ALTER TABLE documents ADD CONSTRAINT documents_error_chk
  CHECK (status = 'failed' OR error IS NULL);

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_size_chk;
ALTER TABLE documents ADD CONSTRAINT documents_size_chk
  CHECK (size_bytes IS NULL OR size_bytes >= 0);
  

-- Deleting a user must not be blocked by (or delete) their documents
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_uploaded_by_fkey;
ALTER TABLE documents ADD CONSTRAINT documents_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL;

-- Indexes
-- Keyset pagination: newest first within a workspace
CREATE INDEX IF NOT EXISTS documents_ws_page_idx
  ON documents (workspace_id, created_at DESC, id DESC);
-- Same, filtered by status
CREATE INDEX IF NOT EXISTS documents_ws_status_page_idx
  ON documents (workspace_id, status, created_at DESC, id DESC);
-- Title search with ILIKE '%text%'
CREATE INDEX IF NOT EXISTS documents_title_trgm_idx
  ON documents USING gin (title gin_trgm_ops);
