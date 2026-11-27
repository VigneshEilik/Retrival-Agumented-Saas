-- 003: Production hardening
--  * Indexes for every tenant-scoped lookup and foreign key used by the application
--  * Content checksum on document versions (duplicate-upload detection)
--  * HNSW vector index when pgvector is installed
--  * SECURITY DEFINER resolver for API keys (lookup by hash happens before tenant context is known)
--
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_org_members_user            ON organization_members (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user         ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_org                ON api_keys (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created      ON audit_logs (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_org                      ON knowledge_bases (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_kb_created        ON documents (knowledge_base_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_org               ON documents (organization_id);
CREATE INDEX IF NOT EXISTS idx_doc_versions_document       ON document_versions (document_id, version);
CREATE INDEX IF NOT EXISTS idx_doc_versions_org_status     ON document_versions (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_version      ON ingestion_jobs (document_version_id);
CREATE INDEX IF NOT EXISTS idx_chunks_org_kb               ON document_chunks (organization_id, knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_chunks_document             ON document_chunks (document_id);
CREATE INDEX IF NOT EXISTS idx_conversations_org_user      ON conversations (organization_id, user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation       ON messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_org                ON messages (organization_id);
CREATE INDEX IF NOT EXISTS idx_message_sources_message     ON message_sources (message_id);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_org_time       ON usage_ledger (organization_id, "timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_org              ON agent_runs (organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_steps_run             ON agent_steps (agent_run_id);
CREATE INDEX IF NOT EXISTS idx_tool_calls_run              ON tool_calls (agent_run_id);

-- ---------------------------------------------------------------------------
-- Duplicate detection: SHA-256 of the uploaded file, per knowledge base
-- ---------------------------------------------------------------------------
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS checksum VARCHAR(64);
UPDATE document_versions SET checksum = metadata->>'checksum' WHERE checksum IS NULL AND metadata ? 'checksum';
CREATE INDEX IF NOT EXISTS idx_doc_versions_org_checksum   ON document_versions (organization_id, checksum);

-- ---------------------------------------------------------------------------
-- Approximate nearest-neighbour index (only when pgvector is available)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_chunks' AND column_name = 'embedding' AND udt_name = 'vector'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw ON document_chunks USING hnsw (embedding vector_cosine_ops)';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- API key resolution
-- api_keys is protected by RLS keyed on the organisation, but an incoming key
-- must be resolved BEFORE we know the organisation. This function runs with the
-- privileges of its owner (the migration role, which must be a superuser or have
-- BYPASSRLS), returns only the owning organisation for a valid, unrevoked,
-- unexpired key, and records last use. It never returns key material.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION resolve_api_key(p_key_hash TEXT)
RETURNS TABLE (api_key_id UUID, organization_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
    UPDATE api_keys k
       SET last_used_at = NOW()
     WHERE k.key_hash = p_key_hash
       AND k.revoked_at IS NULL
       AND (k.expires_at IS NULL OR k.expires_at > NOW())
    RETURNING k.id, k.organization_id;
END;
$$;
