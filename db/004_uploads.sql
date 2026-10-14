-- A document exists before its file arrives, so it needs an "uploading" state
ALTER TYPE doc_status ADD VALUE IF NOT EXISTS 'uploading' BEFORE 'queued';

-- The name the person gave the file (the storage key uses a cleaned version)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS original_filename text;
