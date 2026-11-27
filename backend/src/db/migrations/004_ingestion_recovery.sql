-- 004: Ingestion recovery
-- After a crash or restart, document versions can be left QUEUED/PROCESSING with no job
-- running (e.g. jobs processed in-process while Redis was down). Finding them requires
-- looking across tenants, which RLS forbids for the application role. This SECURITY DEFINER
-- function returns ONLY the identifiers needed to re-dispatch them, nothing else.
-- The owner must be a superuser or have BYPASSRLS (same as resolve_api_key).

CREATE OR REPLACE FUNCTION list_stalled_ingestions(p_older_than_seconds INT DEFAULT 900, p_limit INT DEFAULT 100)
RETURNS TABLE (organization_id UUID, knowledge_base_id UUID, document_id UUID, document_version_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT dv.organization_id, d.knowledge_base_id, dv.document_id, dv.id
    FROM document_versions dv
    JOIN documents d ON d.id = dv.document_id
   WHERE dv.status IN ('QUEUED', 'PROCESSING')
     AND dv.created_at < NOW() - make_interval(secs => p_older_than_seconds)
   ORDER BY dv.created_at
   LIMIT p_limit;
$$;
