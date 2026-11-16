BEGIN;
CREATE TABLE alchemy.project_source_files (
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL,
  owner_name text NOT NULL,
  repository_name text NOT NULL,
  commit_sha text NOT NULL,
  file_path text NOT NULL CHECK (octet_length(file_path) BETWEEN 1 AND 2000),
  blob_sha text NOT NULL CHECK (blob_sha ~ '^[a-f0-9]{40}$'),
  content bytea NOT NULL CHECK (octet_length(content) <= 65536),
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY (workspace_id, project_id, owner_name, repository_name, commit_sha, file_path),
  FOREIGN KEY (workspace_id, project_id, owner_name, repository_name, commit_sha)
    REFERENCES alchemy.project_source_revisions(workspace_id, project_id, owner_name, repository_name, commit_sha)
    ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, recorded_by) REFERENCES alchemy.memberships(workspace_id, actor_id)
);
CREATE INDEX project_source_files_recent ON alchemy.project_source_files (workspace_id, project_id, recorded_at DESC);
ALTER TABLE alchemy.project_source_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE alchemy.project_source_files FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON alchemy.project_source_files TO alchemy_app;
CREATE POLICY member_reads_project_source_files ON alchemy.project_source_files FOR SELECT TO alchemy_app
USING (EXISTS (SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = project_source_files.workspace_id));
CREATE POLICY editor_records_project_source_files ON alchemy.project_source_files FOR INSERT TO alchemy_app
WITH CHECK (recorded_by = alchemy.actor_id() AND EXISTS (SELECT 1 FROM alchemy.memberships m
  WHERE m.workspace_id = project_source_files.workspace_id AND m.role IN ('owner', 'editor')));
COMMIT;
