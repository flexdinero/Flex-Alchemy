BEGIN;
CREATE TABLE alchemy.archive_release_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL,
  run_id uuid NOT NULL UNIQUE REFERENCES alchemy.archive_test_runs(id),
  archive_sha256 text NOT NULL CHECK (archive_sha256 ~ '^[a-f0-9]{64}$'),
  proposed_by uuid NOT NULL,
  proposed_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 1000),
  FOREIGN KEY (workspace_id, project_id) REFERENCES alchemy.projects(workspace_id,id),
  FOREIGN KEY (workspace_id, proposed_by) REFERENCES alchemy.memberships(workspace_id,actor_id)
);
CREATE INDEX archive_release_candidates_recent ON alchemy.archive_release_candidates (workspace_id, project_id, proposed_at DESC);
ALTER TABLE alchemy.archive_release_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE alchemy.archive_release_candidates FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON alchemy.archive_release_candidates TO alchemy_app;
CREATE POLICY member_reads_archive_release_candidates ON alchemy.archive_release_candidates FOR SELECT TO alchemy_app
USING (EXISTS (SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = archive_release_candidates.workspace_id));
CREATE POLICY owner_proposes_archive_release_candidates ON alchemy.archive_release_candidates FOR INSERT TO alchemy_app
WITH CHECK (proposed_by = alchemy.actor_id()
  AND EXISTS (SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = archive_release_candidates.workspace_id AND m.role = 'owner')
  AND EXISTS (
    SELECT 1 FROM alchemy.archive_test_runs r
    JOIN alchemy.project_source_archives a USING (workspace_id, project_id, owner_name, repository_name, commit_sha)
    WHERE r.id = archive_release_candidates.run_id
      AND r.workspace_id = archive_release_candidates.workspace_id AND r.project_id = archive_release_candidates.project_id
      AND r.state = 'finished' AND r.result->>'status' = 'finished' AND r.result->'exitCode' = '0'::jsonb
      AND r.result->>'commit' = r.commit_sha AND r.result->>'archiveSha256' = a.archive_sha256
      AND a.archive_sha256 = archive_release_candidates.archive_sha256));
COMMIT;
