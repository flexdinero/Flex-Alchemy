BEGIN;
CREATE TABLE alchemy.project_source_revisions (
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL,
  owner_name text NOT NULL CHECK (owner_name ~ '^[a-z0-9][a-z0-9-]{0,38}$'),
  repository_name text NOT NULL CHECK (repository_name ~ '^[a-z0-9_.-]{1,100}$' AND repository_name NOT IN ('.','..')),
  commit_sha text NOT NULL CHECK (commit_sha ~ '^[a-f0-9]{40}$'),
  tree_sha text NOT NULL CHECK (tree_sha ~ '^[a-f0-9]{40}$'),
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY (workspace_id, project_id, owner_name, repository_name, commit_sha),
  FOREIGN KEY (workspace_id, project_id) REFERENCES alchemy.projects(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, recorded_by) REFERENCES alchemy.memberships(workspace_id, actor_id)
);
CREATE INDEX project_source_revisions_recent ON alchemy.project_source_revisions (workspace_id, project_id, recorded_at DESC);
ALTER TABLE alchemy.project_source_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alchemy.project_source_revisions FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON alchemy.project_source_revisions TO alchemy_app;
CREATE POLICY member_reads_project_sources ON alchemy.project_source_revisions FOR SELECT TO alchemy_app
USING (EXISTS (SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = project_source_revisions.workspace_id));
CREATE POLICY editor_records_project_sources ON alchemy.project_source_revisions FOR INSERT TO alchemy_app
WITH CHECK (recorded_by = alchemy.actor_id() AND EXISTS (SELECT 1 FROM alchemy.memberships m
  WHERE m.workspace_id = project_source_revisions.workspace_id AND m.role IN ('owner', 'editor')));
COMMIT;
