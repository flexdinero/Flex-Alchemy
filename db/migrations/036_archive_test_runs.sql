BEGIN;
CREATE ROLE alchemy_run_executor NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE ROLE alchemy_run_client NOLOGIN NOINHERIT NOBYPASSRLS;
GRANT alchemy_run_executor TO CURRENT_USER;
GRANT USAGE ON SCHEMA alchemy TO alchemy_run_executor, alchemy_run_client;
GRANT CREATE ON SCHEMA alchemy TO alchemy_run_executor;

CREATE TABLE alchemy.archive_test_runs (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL,
  owner_name text NOT NULL,
  repository_name text NOT NULL,
  commit_sha text NOT NULL,
  requested_by uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','running','finished','failed')),
  lease_token uuid,
  lease_until timestamptz,
  finished_at timestamptz,
  result jsonb CHECK (octet_length(result::text) <= 900000),
  FOREIGN KEY (workspace_id, project_id, owner_name, repository_name, commit_sha)
    REFERENCES alchemy.project_source_archives(workspace_id, project_id, owner_name, repository_name, commit_sha),
  FOREIGN KEY (workspace_id, requested_by) REFERENCES alchemy.memberships(workspace_id, actor_id)
);
CREATE UNIQUE INDEX archive_test_runs_one_active ON alchemy.archive_test_runs
  (workspace_id, project_id, owner_name, repository_name, commit_sha) WHERE state IN ('queued','running');
CREATE INDEX archive_test_runs_pending ON alchemy.archive_test_runs (requested_at, id) WHERE state = 'queued';
ALTER TABLE alchemy.archive_test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE alchemy.archive_test_runs FORCE ROW LEVEL SECURITY;
GRANT SELECT (id, workspace_id, project_id, owner_name, repository_name, commit_sha, requested_by, requested_at, state, finished_at, result),
  INSERT (id, workspace_id, project_id, owner_name, repository_name, commit_sha, requested_by) ON alchemy.archive_test_runs TO alchemy_app;
CREATE POLICY member_reads_archive_runs ON alchemy.archive_test_runs FOR SELECT TO alchemy_app
USING (EXISTS (SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = archive_test_runs.workspace_id));
CREATE POLICY editor_queues_archive_runs ON alchemy.archive_test_runs FOR INSERT TO alchemy_app
WITH CHECK (requested_by = alchemy.actor_id() AND state = 'queued' AND EXISTS (
  SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = archive_test_runs.workspace_id AND m.role IN ('owner','editor')));
GRANT SELECT, UPDATE (state, lease_token, lease_until, finished_at, result) ON alchemy.archive_test_runs TO alchemy_run_executor;
GRANT SELECT ON alchemy.project_source_archives TO alchemy_run_executor;
GRANT SELECT (workspace_id, actor_id, role, revoked_at) ON alchemy.memberships TO alchemy_run_executor;
CREATE POLICY executor_uses_archive_runs ON alchemy.archive_test_runs TO alchemy_run_executor USING (true) WITH CHECK (true);
CREATE POLICY executor_reads_input ON alchemy.project_source_archives FOR SELECT TO alchemy_run_executor USING (true);
CREATE POLICY executor_checks_requester ON alchemy.memberships FOR SELECT TO alchemy_run_executor USING (true);

CREATE FUNCTION alchemy.claim_archive_test_run()
RETURNS TABLE (id uuid, lease_token uuid, commit_sha text, archive_sha256 text, content bytea)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog
AS $$
BEGIN
  UPDATE alchemy.archive_test_runs r SET state = 'failed', finished_at = statement_timestamp(),
    lease_token = NULL, lease_until = NULL, result = '{"status":"lease-expired"}'::jsonb
  WHERE r.state = 'running' AND r.lease_until <= statement_timestamp();
  UPDATE alchemy.archive_test_runs r SET state = 'failed', finished_at = statement_timestamp(),
    result = '{"status":"access-revoked"}'::jsonb
  WHERE r.state = 'queued' AND NOT EXISTS (
    SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = r.workspace_id AND m.actor_id = r.requested_by
      AND m.revoked_at IS NULL AND m.role IN ('owner','editor'));
  RETURN QUERY
  WITH candidate AS (
    SELECT r.id FROM alchemy.archive_test_runs r WHERE r.state = 'queued' AND EXISTS (
      SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = r.workspace_id AND m.actor_id = r.requested_by
        AND m.revoked_at IS NULL AND m.role IN ('owner','editor'))
    ORDER BY r.requested_at, r.id LIMIT 1 FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE alchemy.archive_test_runs r SET state = 'running', lease_token = gen_random_uuid(),
      lease_until = statement_timestamp() + interval '90 seconds'
    FROM candidate WHERE r.id = candidate.id RETURNING r.*
  )
  SELECT r.id, r.lease_token, r.commit_sha, a.archive_sha256, a.content FROM claimed r
  JOIN alchemy.project_source_archives a USING (workspace_id, project_id, owner_name, repository_name, commit_sha);
END;
$$;

CREATE FUNCTION alchemy.finish_archive_test_run(run uuid, lease uuid, outcome jsonb)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog
AS $$
BEGIN
  IF jsonb_typeof(outcome) IS DISTINCT FROM 'object' OR octet_length(outcome::text) > 900000 THEN RETURN false; END IF;
  UPDATE alchemy.archive_test_runs r
  SET state = CASE WHEN outcome->>'status' = 'finished' THEN 'finished' ELSE 'failed' END,
    result = outcome, lease_token = NULL, lease_until = NULL, finished_at = statement_timestamp()
  WHERE r.id = run AND r.lease_token = lease AND r.state = 'running' AND r.lease_until > statement_timestamp();
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION alchemy.claim_archive_test_run(), alchemy.finish_archive_test_run(uuid,uuid,jsonb) FROM PUBLIC;
ALTER FUNCTION alchemy.claim_archive_test_run() OWNER TO alchemy_run_executor;
ALTER FUNCTION alchemy.finish_archive_test_run(uuid,uuid,jsonb) OWNER TO alchemy_run_executor;
REVOKE CREATE ON SCHEMA alchemy FROM alchemy_run_executor;
GRANT EXECUTE ON FUNCTION alchemy.claim_archive_test_run(), alchemy.finish_archive_test_run(uuid,uuid,jsonb) TO alchemy_run_client;
COMMIT;
