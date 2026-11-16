BEGIN;
CREATE TABLE alchemy.project_source_archives (
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL,
  owner_name text NOT NULL,
  repository_name text NOT NULL,
  commit_sha text NOT NULL,
  content bytea NOT NULL CHECK (octet_length(content) BETWEEN 18 AND 8388608),
  archive_sha256 text GENERATED ALWAYS AS (encode(sha256(content), 'hex')) STORED,
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY (workspace_id, project_id, owner_name, repository_name, commit_sha),
  FOREIGN KEY (workspace_id, project_id, owner_name, repository_name, commit_sha)
    REFERENCES alchemy.project_source_revisions(workspace_id, project_id, owner_name, repository_name, commit_sha)
    ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, recorded_by) REFERENCES alchemy.memberships(workspace_id, actor_id)
);
ALTER TABLE alchemy.project_source_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE alchemy.project_source_archives FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON alchemy.project_source_archives TO alchemy_app;
CREATE POLICY member_reads_project_source_archives ON alchemy.project_source_archives FOR SELECT TO alchemy_app
USING (EXISTS (SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = project_source_archives.workspace_id));
CREATE POLICY editor_records_project_source_archives ON alchemy.project_source_archives FOR INSERT TO alchemy_app
WITH CHECK (recorded_by = alchemy.actor_id() AND EXISTS (SELECT 1 FROM alchemy.memberships m
  WHERE m.workspace_id = project_source_archives.workspace_id AND m.role IN ('owner', 'editor')));
COMMIT;
