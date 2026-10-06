-- ============================================================
-- EXTENSIONS
-- ============================================================

-- "CREATE EXTENSION" enables an additional PostgreSQL feature.
--
-- "vector" is the pgvector extension.
--
-- pgvector allows PostgreSQL to store and search numerical
-- vectors, which we need for semantic search in our RAG system.
--
-- "IF NOT EXISTS" means:
--     Create it only if it does not already exist.
--
-- Without "IF NOT EXISTS", running this statement again could
-- produce an error saying that the extension already exists.
CREATE EXTENSION IF NOT EXISTS vector;


-- "pgcrypto" is a PostgreSQL extension that provides
-- cryptographic functions.
--
-- We mainly need it here because it provides:
--
--     gen_random_uuid()
--
-- which generates random UUID values for our primary keys.
--
-- Without pgcrypto, gen_random_uuid() may not be available
-- depending on the PostgreSQL version/configuration.
CREATE EXTENSION IF NOT EXISTS pgcrypto;



-- ============================================================
-- ENUM TYPES
-- ============================================================

-- "CREATE TYPE" creates a custom data type in PostgreSQL.
--
-- "member_role" is our custom type for workspace membership roles.
--
-- "AS ENUM" means this type can contain ONLY the values listed
-- inside the parentheses.
--
-- Therefore a member_role can be:
--
--     'admin'
--     'member'
--
-- but NOT:
--
--     'owner'
--     'manager'
--     'abc'
--
-- This helps keep our data consistent.
CREATE TYPE member_role AS ENUM ('admin', 'member');


-- Create another custom ENUM type for document processing status.
--
-- A document can be:
--
--     queued      → waiting to be processed
--     processing  → currently being processed
--     ready       → successfully processed
--     failed      → processing failed
CREATE TYPE doc_status AS ENUM (
  'queued',
  'processing',
  'ready',
  'failed'
);


-- Create an ENUM type representing who/what created a message.
--
-- 'user'      → message came from the user
-- 'assistant' → message came from the AI assistant
-- 'tool'      → message/result came from an AI tool
CREATE TYPE msg_role AS ENUM (
  'user',
  'assistant',
  'tool'
);



-- ============================================================
-- USERS TABLE
-- ============================================================

-- "CREATE TABLE" creates a new database table.
--
-- "users" is the name of our table.
--
-- A table is similar to a class/model/interface conceptually,
-- but in a relational database it stores actual rows of data.
CREATE TABLE users (


  -- "id" is the column name.
  --
  -- "uuid" is the data type.
  --
  -- UUID = Universally Unique Identifier.
  --
  -- Example:
  --
  --     550e8400-e29b-41d4-a716-446655440000
  --
  -- "PRIMARY KEY" means:
  --
  --     1. Every user must have a unique id.
  --     2. The id cannot be NULL.
  --     3. Other tables can reference this user.
  --
  -- "DEFAULT gen_random_uuid()" means PostgreSQL automatically
  -- generates an ID when we insert a user without providing one.
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),


  -- "email" stores the user's email address.
  --
  -- "text" means variable-length text.
  --
  -- "UNIQUE" means two users cannot have the same email.
  --
  -- "NOT NULL" means every user MUST have an email.
  --
  -- Therefore:
  --
  --     email = required
  --     email = unique
  email text UNIQUE NOT NULL,


  -- Stores the hashed password.
  --
  -- We should NEVER store the user's actual password here.
  --
  -- Instead, the backend should store something like:
  --
  --     hashed_password
  --
  -- "text" is used because password hashes are strings.
  --
  -- Notice there is NO "NOT NULL".
  --
  -- That means password_hash can be NULL.
  --
  -- This can be useful if we later support OAuth/social login
  -- where a user may not have a local password.
  password_hash text,


  -- Stores the user's display/name.
  --
  -- Because there is no NOT NULL, this field is optional.
  name text,


  -- Stores when the user was created.
  --
  -- "timestamptz" means timestamp WITH time zone.
  --
  -- "NOT NULL" means every user must have a creation time.
  --
  -- "DEFAULT now()" automatically inserts the current timestamp
  -- when a user is created.
  created_at timestamptz NOT NULL DEFAULT now()

);



-- ============================================================
-- WORKSPACES TABLE
-- ============================================================

-- A workspace represents a separate knowledge area/tenant
-- in Lumen.
--
-- Example:
--
--     Company A workspace
--     Company B workspace
--
-- Documents and conversations can belong to different
-- workspaces.
CREATE TABLE workspaces (


  -- Unique ID for the workspace.
  --
  -- UUID is automatically generated if no ID is supplied.
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),


  -- Workspace name.
  --
  -- NOT NULL means every workspace must have a name.
  --
  -- Example:
  --
  --     "Marketing Knowledge Base"
  --     "Acme Engineering"
  name text NOT NULL,


  -- "created_by" stores the ID of the user who created
  -- the workspace.
  --
  -- "uuid" matches users.id.
  --
  -- "REFERENCES users(id)" creates a foreign-key relationship.
  --
  -- In other words:
  --
  --     workspaces.created_by
  --              ↓
  --          users.id
  --
  -- PostgreSQL will prevent us from referencing a user ID
  -- that doesn't exist.
  created_by uuid REFERENCES users(id),


  -- Time when the workspace was created.
  --
  -- Automatically gets the current time.
  created_at timestamptz NOT NULL DEFAULT now()

);



-- ============================================================
-- MEMBERSHIPS TABLE
-- ============================================================

-- This table connects USERS to WORKSPACES.
--
-- Why do we need a separate table?
--
-- Because one user can belong to multiple workspaces,
-- and one workspace can have multiple users.
--
-- This is called a MANY-TO-MANY relationship.
--
-- Example:
--
-- User A ───── Workspace 1
-- User A ───── Workspace 2
-- User B ───── Workspace 1
CREATE TABLE memberships (


  -- ID of the workspace this membership belongs to.
  --
  -- It references workspaces.id.
  --
  -- "ON DELETE CASCADE" means:
  --
  -- If the workspace is deleted,
  -- its memberships are automatically deleted too.
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,


  -- ID of the user who belongs to the workspace.
  --
  -- "ON DELETE CASCADE" means:
  --
  -- If the user is deleted,
  -- their membership records are automatically deleted.
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,


  -- Role of this user inside this workspace.
  --
  -- The type is our custom "member_role" ENUM.
  --
  -- "NOT NULL" means every membership must have a role.
  --
  -- "DEFAULT 'member'" means if no role is provided,
  -- PostgreSQL automatically uses "member".
  role member_role NOT NULL DEFAULT 'member',


  -- Composite primary key.
  --
  -- Instead of one column being unique,
  -- the COMBINATION of workspace_id + user_id must be unique.
  --
  -- This prevents:
  --
  --     User 1 + Workspace 1
  --     User 1 + Workspace 1
  --
  -- from being inserted twice.
  PRIMARY KEY (workspace_id, user_id)

);



-- ============================================================
-- REFRESH TOKENS TABLE
-- ============================================================

-- Stores refresh-token information for authentication.
--
-- Access tokens are usually short-lived.
-- Refresh tokens allow the application to obtain a new
-- access token without forcing the user to log in again.
CREATE TABLE refresh_tokens (


  -- Unique ID for the refresh-token record.
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),


  -- Which user owns this refresh token?
  --
  -- References users.id.
  --
  -- If the user is deleted, their refresh tokens are also
  -- automatically deleted because of ON DELETE CASCADE.
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,


  -- Stores the HASH of the refresh token.
  --
  -- We should not normally store the raw token itself.
  --
  -- Instead:
  --
  --     raw token
  --          ↓
  --        hash
  --          ↓
  --     store hash
  --
  -- This improves security if the database is compromised.
  token_hash text NOT NULL,


  -- Time when the refresh token expires.
  --
  -- NOT NULL means every token must have an expiration time.
  expires_at timestamptz NOT NULL,


  -- Indicates whether the token has been revoked.
  --
  -- BOOLEAN can contain:
  --
  --     TRUE
  --     FALSE
  --
  -- New tokens are not revoked by default.
  revoked boolean NOT NULL DEFAULT false

);



-- ============================================================
-- DOCUMENTS TABLE
-- ============================================================

-- Stores metadata about documents uploaded to Lumen.
--
-- IMPORTANT:
--
-- The actual PDF/file does NOT necessarily need to be stored
-- in PostgreSQL.
--
-- The actual file can live in MinIO.
--
-- PostgreSQL stores information ABOUT the file.
CREATE TABLE documents (


  -- Unique ID for the document.
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),


  -- Workspace that owns this document.
  --
  -- Every document MUST belong to a workspace.
  --
  -- If the workspace is deleted,
  -- its documents are automatically deleted.
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,


  -- Human-readable document title.
  --
  -- Example:
  --
  --     "Company Employee Handbook"
  title text NOT NULL,


  -- Describes where/how the document came from.
  --
  -- Example:
  --
  --     "pdf"
  --     "docx"
  --     "upload"
  --     "url"
  source_type text NOT NULL,


  -- Location/key of the actual file in object storage.
  --
  -- For example, MinIO might contain:
  --
  --     workspace-123/documents/file.pdf
  --
  -- That path/key can be stored here.
  --
  -- It is optional because there is no NOT NULL.
  storage_key text,


  -- Processing status of the document.
  --
  -- Uses our custom doc_status ENUM.
  --
  -- New documents start as:
  --
  --     queued
  --
  -- Then potentially:
  --
  --     queued
  --        ↓
  --     processing
  --        ↓
  --     ready
  --
  -- Or:
  --
  --     processing
  --        ↓
  --     failed
  status doc_status NOT NULL DEFAULT 'queued',


  -- Stores an error message if document processing fails.
  --
  -- Example:
  --
  --     "Unable to extract text from PDF"
  --
  -- It is optional, so NULL is allowed.
  error text,


  -- User who uploaded the document.
  --
  -- References users.id.
  uploaded_by uuid REFERENCES users(id),


  -- Time when the document record was created.
  created_at timestamptz NOT NULL DEFAULT now()

);



-- Create an index for faster document queries.
--
-- "(workspace_id, created_at DESC)" means the index contains
-- these two columns.
--
-- This is useful for queries such as:
--
--     Get documents belonging to workspace X
--     ordered from newest to oldest.
--
-- "DESC" means descending order.
--
-- Without this index, PostgreSQL may need to scan many rows
-- and sort them manually for large datasets.
CREATE INDEX ON documents (workspace_id, created_at DESC);



-- ============================================================
-- CHUNKS TABLE
-- ============================================================

-- This is one of the most important tables for the RAG system.
--
-- A document is split into smaller pieces called "chunks".
--
-- Example:
--
--     PDF
--      ↓
--     100 pages
--      ↓
--     500 chunks
--      ↓
--     embeddings
--      ↓
--     vector search
--
-- Each row in this table represents one chunk.
CREATE TABLE chunks (


  -- Unique ID for this chunk.
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),


  -- ID of the original document.
  --
  -- Every chunk belongs to a document.
  --
  -- If the document is deleted, all its chunks are automatically
  -- deleted because of ON DELETE CASCADE.
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,


  -- Workspace to which this chunk belongs.
  --
  -- Keeping workspace_id here makes workspace-level filtering
  -- much easier and faster.
  --
  -- For a multi-tenant application like Lumen, this is important.
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,


  -- Position of this chunk inside the document.
  --
  -- Example:
  --
  --     chunk_index = 0
  --     chunk_index = 1
  --     chunk_index = 2
  --
  -- This allows us to preserve the original chunk order.
  chunk_index int NOT NULL,


  -- Page number from the original document.
  --
  -- It is optional because some documents may not have
  -- meaningful page numbers.
  page int,


  -- Actual text content of the chunk.
  --
  -- This is the text that will be embedded and searched.
  --
  -- NOT NULL means every chunk must contain content.
  content text NOT NULL,


  -- Vector embedding for this chunk.
  --
  -- "vector(1024)" means:
  --
  --     This column stores a vector containing 1024 numbers.
  --
  -- Example conceptually:
  --
  --     [0.12, -0.42, 0.81, ...]
  --
  -- The vector is generated by an embedding model.
  --
  -- RAG uses these vectors to find semantically similar
  -- chunks.
  --
  -- IMPORTANT:
  -- The number 1024 MUST match the dimensionality of the
  -- embedding model you use.
  embedding vector(1024),


  -- "tsvector" is PostgreSQL's full-text-search data type.
  --
  -- "GENERATED ALWAYS AS" means PostgreSQL automatically
  -- calculates this value from the content column.
  --
  -- "to_tsvector('english', content)" converts the text into
  -- a searchable representation for PostgreSQL full-text search.
  --
  -- "STORED" means PostgreSQL physically stores the generated
  -- result rather than calculating it every time we query it.
  --
  -- This gives us another search mechanism in addition to
  -- vector/semantic search.
  tsv tsvector
    GENERATED ALWAYS AS (
      to_tsvector('english', content)
    ) STORED

);



-- ============================================================
-- VECTOR SEARCH INDEX
-- ============================================================

-- Create an HNSW index on the embedding column.
--
-- HNSW = Hierarchical Navigable Small World.
--
-- It is a vector-search indexing algorithm designed to make
-- similarity searches much faster.
--
-- "USING hnsw" tells PostgreSQL/pgvector to use HNSW.
--
-- "(embedding vector_cosine_ops)" tells pgvector to use
-- cosine distance/similarity operations for this index.
--
-- This is important for RAG retrieval because we commonly
-- compare the query embedding against document embeddings
-- using cosine similarity.
--
-- Without an appropriate vector index, similarity searches
-- can become slow as the number of chunks grows.
CREATE INDEX ON chunks
USING hnsw (embedding vector_cosine_ops);



-- Create a GIN index on the tsv column.
--
-- GIN = Generalized Inverted Index.
--
-- It is commonly used for PostgreSQL full-text search.
--
-- Our tsv column contains the searchable representation of
-- the chunk's text.
--
-- This allows PostgreSQL to efficiently perform keyword-based
-- searches.
CREATE INDEX ON chunks USING gin (tsv);



-- Create an index on workspace_id.
--
-- This is important in a multi-tenant system.
--
-- When searching chunks, we often want:
--
--     "Only search chunks belonging to this workspace."
--
-- The index helps PostgreSQL find those chunks efficiently.
CREATE INDEX ON chunks (workspace_id);



-- ============================================================
-- CONVERSATIONS TABLE
-- ============================================================

-- Stores chat conversations.
--
-- Example:
--
--     User opens Lumen
--          ↓
--     Creates conversation
--          ↓
--     "Ask about company policy"
--
-- The actual individual messages will be stored separately
-- in the messages table.
CREATE TABLE conversations (


  -- Unique ID for the conversation.
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),


  -- Workspace where this conversation belongs.
  --
  -- If the workspace is deleted, its conversations are
  -- automatically deleted.
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,


  -- User who owns/created the conversation.
  --
  -- References users.id.
  user_id uuid NOT NULL REFERENCES users(id),


  -- Optional title for the conversation.
  --
  -- Example:
  --
  --     "Company Leave Policy"
  --
  -- NULL is allowed because a conversation might initially
  -- have no title.
  title text,


  -- Time when the conversation was created.
  created_at timestamptz NOT NULL DEFAULT now()

);



-- ============================================================
-- MESSAGES TABLE
-- ============================================================

-- Stores individual messages inside conversations.
--
-- One conversation can contain many messages.
--
-- Example:
--
-- Conversation
--     │
--     ├── User message
--     ├── Assistant message
--     ├── Tool message
--     └── Assistant message
CREATE TABLE messages (


  -- Unique ID for each message.
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),


  -- Which conversation does this message belong to?
  --
  -- "ON DELETE CASCADE" means if the conversation is deleted,
  -- all messages inside it are automatically deleted.
  conversation_id uuid NOT NULL
    REFERENCES conversations(id)
    ON DELETE CASCADE,


  -- Who produced this message?
  --
  -- Uses our custom msg_role ENUM:
  --
  --     user
  --     assistant
  --     tool
  role msg_role NOT NULL,


  -- Actual message content.
  --
  -- For a user:
  --
  --     "What is our leave policy?"
  --
  -- For the assistant:
  --
  --     "According to the employee handbook..."
  content text NOT NULL,


  -- Stores citation information as JSON.
  --
  -- JSONB is PostgreSQL's binary JSON data type.
  --
  -- This can store structured citation information such as:
  --
  --     document ID
  --     chunk ID
  --     page number
  --     source title
  --     relevance score
  --
  -- Example concept:
  --
  -- [
  --   {
  --     "document_id": "...",
  --     "page": 5,
  --     "title": "Employee Handbook"
  --   }
  -- ]
  --
  -- It is optional because not every message needs citations.
  citations jsonb,


  -- Stores which version of the prompt was used to generate
  -- the assistant response.
  --
  -- This is useful for debugging and evaluation.
  --
  -- Example:
  --
  --     "rag-v1"
  --     "rag-v2"
  --
  -- If the prompt changes later, we can know which version
  -- generated an old response.
  prompt_version text,


  -- Number of tokens sent to the LLM.
  --
  -- Useful for tracking usage and potentially calculating
  -- AI/API costs.
  input_tokens int,


  -- Number of tokens generated by the LLM.
  output_tokens int,


  -- How long the request took.
  --
  -- Stored in milliseconds.
  --
  -- Example:
  --
  --     850
  --
  -- means approximately 850 milliseconds.
  latency_ms int,


  -- Time when the message was created.
  created_at timestamptz NOT NULL DEFAULT now()

);



-- Create an index for retrieving messages efficiently.
--
-- We commonly need to ask:
--
--     "Give me all messages for conversation X,
--      ordered by creation time."
--
-- This index contains:
--
--     conversation_id
--     created_at
--
-- in that order.
CREATE INDEX ON messages (conversation_id, created_at);



-- ============================================================
-- FEEDBACK TABLE
-- ============================================================

-- Stores user feedback about an AI message.
--
-- Example:
--
--     👍 Helpful
--     👎 Not helpful
--
-- This can later be used to evaluate the quality of the
-- Lumen RAG/AI system.
CREATE TABLE feedback (


  -- The message receiving the feedback.
  --
  -- PRIMARY KEY means one message can have only ONE feedback
  -- record in this table.
  --
  -- "REFERENCES messages(id)" connects feedback to a message.
  --
  -- "ON DELETE CASCADE" means if the message is deleted,
  -- its feedback is automatically deleted.
  message_id uuid PRIMARY KEY
    REFERENCES messages(id)
    ON DELETE CASCADE,


  -- User who submitted the feedback.
  --
  -- This connects the feedback to a user.
  user_id uuid REFERENCES users(id),


  -- Feedback rating.
  --
  -- "smallint" is a small integer data type.
  --
  -- "NOT NULL" means rating is required.
  --
  -- "CHECK (rating IN (-1, 1))" means PostgreSQL will only
  -- accept two possible values:
  --
  --     -1 → negative feedback
  --      1 → positive feedback
  --
  -- Values such as:
  --
  --      0
  --      2
  --      5
  --
  -- will be rejected.
  rating smallint NOT NULL CHECK (rating IN (-1, 1)),


  -- Optional text explaining the feedback.
  --
  -- Example:
  --
  --     "The answer did not include the correct document."
  comment text,


  -- Time when the feedback was submitted.
  created_at timestamptz NOT NULL DEFAULT now()

);CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role member_role NOT NULL DEFAULT 'member',
  token_hash text NOT NULL UNIQUE,
  invited_by uuid REFERENCES users(id),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS invitations_pending_idx
  ON invitations (workspace_id, email) WHERE accepted_at IS NULL;
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
