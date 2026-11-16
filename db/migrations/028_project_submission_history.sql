BEGIN;
CREATE TABLE alchemy.project_submissions (
  workspace_id uuid NOT NULL REFERENCES alchemy.workspaces(id),
  actor_id uuid NOT NULL,
  submission_key uuid NOT NULL,
  project_id uuid NOT NULL,
  digest text NOT NULL,
  PRIMARY KEY (workspace_id, actor_id, submission_key)
);
ALTER TABLE alchemy.projects NO FORCE ROW LEVEL SECURITY;
INSERT INTO alchemy.project_submissions
SELECT workspace_id, submission_actor, submission_key, id, submission_digest
FROM alchemy.projects WHERE submission_key IS NOT NULL;
ALTER TABLE alchemy.projects FORCE ROW LEVEL SECURITY;
ALTER TABLE alchemy.project_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alchemy.project_submissions FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON alchemy.project_submissions TO alchemy_app;
CREATE POLICY own_project_submissions ON alchemy.project_submissions TO alchemy_app
USING (actor_id = alchemy.actor_id() AND EXISTS (
  SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = project_submissions.workspace_id
  AND m.role IN ('owner', 'editor')
));
COMMIT;
