-- Chat History Table
--
-- Stores every user ↔ AI message exchange for two purposes:
--   1. Compliance — a durable audit trail of all AI interactions per user.
--   2. On-demand recall — the AI can search this table via the
--      `search_past_conversations` MCP tool when a user explicitly asks
--      about a previous conversation topic.
--
-- This table is APPEND-ONLY from the application's perspective.
-- Messages are never updated or deleted through normal operation.

CREATE TABLE IF NOT EXISTS chat_history (
    id         SERIAL PRIMARY KEY,

    -- The Salesforce User ID (e.g. '005Dn000001XXXXX') of the authenticated user.
    -- All queries are scoped to this column to prevent cross-user data access.
    user_id    VARCHAR(255) NOT NULL,

    -- 'user'  — the human's message
    -- 'model' — the AI's response
    role       VARCHAR(50)  NOT NULL,

    -- The raw text content of the message.
    content    TEXT         NOT NULL,

    -- TIMESTAMPTZ stores timezone-aware timestamps.
    -- Safer than plain TIMESTAMP when the server and users may be in different
    -- timezones (e.g. Render servers run in UTC, users are in IST +05:30).
    created_at TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

-- Composite index on (user_id, created_at DESC)
--
-- Our primary query pattern is always:
--   WHERE user_id = $1 AND content ILIKE $2 ORDER BY created_at DESC
--
-- A composite index on (user_id, created_at DESC) allows Postgres to satisfy
-- both the equality filter on user_id AND the sort on created_at in a single
-- index scan, which is more efficient than two separate single-column indexes.
CREATE INDEX IF NOT EXISTS idx_chat_history_user_created
    ON chat_history (user_id, created_at DESC);
